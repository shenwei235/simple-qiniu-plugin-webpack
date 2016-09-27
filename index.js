var qiniu = require('qiniu');
var fs = require('fs');
function qiniuUploader(options) {
	this.options = options;
	this.inited = false;
	this.needUploadFileLength = 0;
	this.uploadedFileLength = 0;
	this.replacedFiles = [];
	this.cssImages = [];
	this.publicPath = '';
	this.projectPath = '';
	this.hasRequiredOptions = true;
	this.setPath = function(publicPath, projectPath) {
		this.publicPath = publicPath;
		this.projectPath = projectPath;
	}
	this.isInclude = function(filename) {
		return this.options.include.test(filename);
	}
	this.formatDate = function(date) {
		// YYYYmmdd format, if you want it, pls uncomment below lines...
	  	// var m = date.getMonth() + 1,
	  	// 	d = date.getDate();
	  	// return [date.getFullYear(), !m[1] && '0', m, !d[1] && '0', d].join('');
	  	return date.getTime();
	}
	this.replaceFilesWithCDN = function(prefix) {
		var rootHTML = this.projectPath.indexOf('\\') > -1 ? this.projectPath + '\\..\\index.html' : this.projectPath + '/../index.html';
		var urlPrefix = this.options.domain + '/' + prefix;
		this.replaceContentsFromFile(rootHTML, this.replacedFiles, urlPrefix);
	}
	this.buildPathRegex = function() {
		return this.publicPath.split('\/').reduce(function(arr, item) {
			if(item.trim()) {
				arr.push(item);
			}
			return arr;
		}, []).join('\\/');
	}
	this.replaceContentsFromFile = function(path, names, url_prefix, cb) {
		var self = this;
		fs.readFile(path, 'utf8', function(err, data) {
		  	if (err) {
		    	return console.log(err);
		  	}
		  	var result = data;
		  	console.log('\n----replace ' + path + ' with Qiniu url----\n');
		  	names.map(function(name, index) {
		  		var reg = new RegExp('\/' + self.buildPathRegex() + '\/' + name, 'g');
		  		if(result.match(reg)) {
		  			console.log('replace /' + self.publicPath + '/'+ name + ' with ' + url_prefix + name + ' in ' + path);
		  		}
		  		result = result.replace(reg, url_prefix + name);
		  	});
		  	console.log('\n----replace ' + path + ' with Qiniu url----\n');

		  	fs.writeFile(path, result, 'utf8', function (err) {
		     	if (err) return console.log(err);
		     	cb && cb();
		  	});
		});
	}
	this.realUploadFile = function(filename, uptoken, key, localFile, prefix) {
		var self = this;
	  	var extra = new qiniu.io.PutExtra();
	    qiniu.io.putFile(uptoken, key, localFile, extra, function(err, ret) {
	      	if(!err) {
	      		self.uploadedFileLength++;
		        // 上传成功， 处理返回值
		        console.log('upload ' + filename + ' successfully...');
		        self.replacedFiles.push(filename);
		        if(self.uploadedFileLength == self.needUploadFileLength) {
		        	self.replaceFilesWithCDN(prefix);
		        }       
	      	} else {
		        // 上传失败， 处理返回代码
		        console.log(err);
	      	}
	  	});
	}
	this.uploadToken = function(bucket, key) {
		//构建上传策略函数
		var putPolicy = new qiniu.rs.PutPolicy(bucket + ":" + key);
	  	return putPolicy.token();	
	}
	this.uploadFile = function(prefix, file) {
		//要上传的空间
		var bucket = this.options.bucket;
		//上传到七牛后保存的文件名
		var key = prefix + file.name;
		//生成上传 Token
		var uptoken = this.uploadToken(bucket, key);
		//调用uploadFile上传
		this.realUploadFile(file.name, uptoken, key, file.path, prefix);
	}
	this.startUploadFiles = function(prefix, files) {
		var self = this;
		self.needUploadFileLength = files.length;
		files.map(function(file, index) {
			if(/.*\.css$/.test(file.name)) {
				self.replaceImagesUrlWithCDN(prefix, file);
			} else {
				self.uploadFile(prefix, file);
			}
		});
	}
	this.replaceImagesUrlWithCDN = function(prefix, file) {
		var cssFile = file.path,
			self = this,
			urlPrefix = self.options.domain + '/' + prefix;
		self.replaceContentsFromFile(cssFile, self.cssImages, urlPrefix, function() {
			self.uploadFile(prefix, file);
		});
	}
	this.init = function() {
		if(this.inited) return;
		if(options.access && options.secret && options.domain && options.include && options.bucket) {
			//需要填写你的 Access Key 和 Secret Key
			qiniu.conf.ACCESS_KEY = this.options.access;
			qiniu.conf.SECRET_KEY = this.options.secret;
			this.inited = true;
		} else {
			this.hasRequiredOptions = false;
		}
	}
}

qiniuUploader.prototype.apply = function(compiler) {
	var self = this;
	compiler.plugin('after-emit', function(compilation, callback) {
		self.init();
		if(!self.hasRequiredOptions) {
			compilation.errors.push(new Error('Options(domain, access, secret, bucket, include) are required!'));
			callback();
		}
		self.setPath(compiler.options.output.publicPath, compiler.options.output.path);
		var total_assets = [];
		// fetch all assets files
		for(key in compilation.assets) {
			total_assets.push({name: key, path: compilation.assets[key]['existsAt']});
		}
		// filter wanted files
		var valid_assets = total_assets.reduce(function(res, file) {
	      	if (self.isInclude(file.name)) {
	      		res.push(file)
	      	}
			return res
		}, []);
		// filter images,svg...
		valid_assets.map(function(file, index) {
			if(/.*\.(svg|jpg|jpeg|png|gif)$/.test(file.name)) {
				self.cssImages.push(file.name);
			}
		});
		console.log('\n----grab css related images----');
		console.log(self.cssImages);
		console.log('\n----grab css related images----\n');
		// upload
		var prefix = (self.options.prefix ? self.options.prefix + '/' : '') + self.formatDate(new Date()) + '/';
		self.startUploadFiles(prefix, valid_assets);
	    callback();
  	});
};

module.exports = qiniuUploader;