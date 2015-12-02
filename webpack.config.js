'use strict';
var ExtractTextPlugin = require('extract-text-webpack-plugin');
module.exports = {
    entry: './public_html/script/src/index.es6',
    output: {
        path: './public_html/',
        filename: 'script/main.js'
    },
    module: {
        loaders: [
            { test: /\.scss$/, loader: ExtractTextPlugin.extract('style', 'css!autoprefixer!sass') },
            { test: /\.es6$/, loader: 'babel' }
        ]
    },
    plugins: [
        new ExtractTextPlugin('style/main.css')
    ]
};
