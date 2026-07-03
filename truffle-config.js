module.exports = {
  contracts_directory: "./contracts",
  contracts_build_directory: "./build",
  test_directory: "./test",
  compilers: {
    solc: {
      version: "0.4.26",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
