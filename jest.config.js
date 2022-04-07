module.exports = {
  collectCoverageFrom: ['src/**/*.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|styl|less|sass|scss)$': '<rootDir>/build-config/style-stub.js',
  },
};
