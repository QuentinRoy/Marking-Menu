module.exports = {
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|styl|less|sass|scss)(\\?inline)?$': '<rootDir>/jest-style-stub.js',
  },
};
