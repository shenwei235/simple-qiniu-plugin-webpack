# simple-qiniu-plugin-webpack
upload assets to Qiniu after webpack bundle, inspired from https://github.com/MikaAK/s3-plugin-webpack.

USAGE:
<pre>
plugins: [
    new qiniuUploader({
        domain: 'your qiniu domain',
        access: 'your qiniu access',
        secret: 'your qiniu secret',
        bucket: 'the bucket of your qiniu account',
        prefix: 'the prefix after bucket',
        include: /.*\.(js|css|svg|jpg|gif)$/, // /.*\.(js|css)$/
    })
]
</pre>
