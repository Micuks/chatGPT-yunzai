import fs from "node:fs";

class version {
  constructor() {
    this.name = "chatGPT-yunzai";
    this.version = "0.0.0";
  }

  async init() {
    let pwd = process.cwd();
    this._packageData = fs.readFileSync(
      `${pwd}/plugins/chatGPT-yunzai/package.json`,
      "utf8"
    );
    this._packageInfo = await JSON.parse(this._packageData);

    this.version = this._packageInfo.version || this.version;
    // package name is in lowercase format, but this plugin's directory name is not in this format
  }
  async getPacakgeInfo() {
    return this._packageInfo;
  }
}

const Version = new version();
await Version.init();

export default Version;
