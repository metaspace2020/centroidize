var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: './static/index.js',
    output: { path: 'static', filename: 'bundle.js' },
    module: {
        loaders: [
            {
                test: /.css?$/,
                loader: 'style-loader!css-loader'
            },
            {
                test: /\.js$/,
                loader: 'babel',
                query: {
                    presets: ['es2015']
                }
            }
        ]
    }
};
