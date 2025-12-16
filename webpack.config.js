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
        app: path.join(__dirname, 'index.web.js'),
    },
    output: {
        path: path.resolve(appDirectory, 'dist'),
        publicPath: '/',
        filename: 'rnw.bundle.js',
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
    },
    module: {
        rules: [
            babelLoaderConfiguration,
            imageLoaderConfiguration,
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'public/index.html'),
        }),
    ],
    devServer: {
        host: 'localhost',
        setupMiddlewares: (middlewares, devServer) => {
            if (!devServer || !devServer.app) {
                return middlewares;
            }

            devServer.app.post('/__tensai_exit', (req, res) => {
                const origin = req.headers.origin || '';
                const referer = req.headers.referer || '';
                const host = req.headers.host || '';
                const exitHeader = req.headers['x-tensai-exit'];

                const originLooksLocal =
                    typeof origin === 'string' &&
                    (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'));
                const refererLooksLocal =
                    typeof referer === 'string' &&
                    (referer.startsWith('http://localhost') || referer.startsWith('http://127.0.0.1'));
                const localHost =
                    typeof host === 'string' && (host.startsWith('localhost') || host.startsWith('127.0.0.1'));

                if (!localHost || exitHeader !== '1' || (!originLooksLocal && origin !== '' && !refererLooksLocal)) {
                    res.status(403).send('Forbidden');
                    return;
                }

                res.status(200).send('Shutting down');
                setTimeout(() => {
                    process.exit(0);
                }, 250);
            });

            return middlewares;
        },
    },
};
