const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appDirectory = path.resolve(__dirname);
const { presets } = require(`${appDirectory}/babel.config.js`);

const compileNodeModules = [
    // Add every react-native package that needs compiling
    'react-native-svg',
    '@react-native-async-storage/async-storage',
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const babelLoaderConfiguration = {
    test: /\.(js|jsx|ts|tsx)$/,
    // Add every directory that needs to be compiled by Babel during the build.
    include: [
        path.resolve(appDirectory, 'index.web.js'),
        path.resolve(appDirectory, 'popup.js'),
        path.resolve(appDirectory, 'App.tsx'),
        path.resolve(appDirectory, 'mobile'),
        ...compileNodeModules,
    ],
    use: {
        loader: 'babel-loader',
        options: {
            cacheDirectory: true,
            presets,
            plugins: ['react-native-web'],
        },
    },
};

const imageLoaderConfiguration = {
    test: /\.(gif|jpe?g|png|svg)$/,
    use: {
        loader: 'url-loader',
        options: {
            name: '[name].[ext]',
            esModule: false,
        },
    },
};

module.exports = {
    entry: {
        quiz: path.join(__dirname, 'index.web.js'),
        popup: path.join(__dirname, 'popup.js'),
    },
    output: {
        path: path.resolve(appDirectory, 'dist'),
        publicPath: '',
        filename: '[name].bundle.js',
    },
    resolve: {
        extensions: [
            '.web.tsx',
            '.web.ts',
            '.tsx',
            '.ts',
            '.web.js',
            '.js',
        ],
        alias: {
            'react-native$': 'react-native-web',
            '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage/lib/commonjs/index.js',
        },
        fallback: {
            buffer: require.resolve('buffer/'),
        },
    },
    module: {
        rules: [
            babelLoaderConfiguration,
            imageLoaderConfiguration,
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'public/quiz.html'),
            filename: 'quiz.html',
            chunks: ['quiz'],
        }),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'public/popup.html'),
            filename: 'popup.html',
            chunks: ['popup'],
        }),
    ],
};
