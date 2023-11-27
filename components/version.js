import fs from "node:fs";

class version {
  constructor() {
    this._packageData = fs.readFileSync("../package.json", "utf8");
  }
  async getPacakgeInfo() {
    if (
      this._packageInfo === undefined ||
      this._packageInfo === null ||
      this._packageInfo === ""
    ) {
      this._packageInfo = await JSON.parse(this._packageData);
    }

    return this._packageInfo;
  }
  async version() {
    if (
      this._version === "" ||
      this._version === undefined ||
      this._version === null
    ) {
      this._version = this.packageInfo.version;
    }

    return this._version;
  }
  async name() {
    if (this._name === "" || this._name === undefined || this._name === null) {
      this._name = this.packageInfo.name;
    }

    return this._name;
  }
}

const Version = new version();

export default Version;
