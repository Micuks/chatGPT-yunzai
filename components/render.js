import Version from "./version.js";
export default class Render {
  constructor() {
    this.imgTemplatePath = "/common/image-template/html";
    this.version = Version.version;
    this.name = Version.name;
  }

  async renderUrl(e, imgUrl) {
    if (!e.runtime) {
      console.log(`e.runtime not found. Please update your Yunzai to latest.`);
    }

    let data = {
      image_url: imgUrl,
      copyright: `Created by ChatGPT-Yunzai <span class="version">${this.version}</span>`,
    };

    let response = await e.runtime.render(
      this.name,
      this.imgTemplatePath,
      data,
      {
        retType: "default",
        beforeRender({ data }) {
          // let resPath = data.pluResPath;
          // const layoutPath =
          //   process.cwd() + "/plugins/chatGPT-yunzai/resources/common/";
          return {
            //   _miao_path: resPath,
            ...data,
            //   _res_path: resPath,
            //   _layout_path: layoutPath,
            //   defaultLayout: layoutPath + "image-template.html",
            sys: {
              scale: 1.4,
            },
            //   copyright: `Created by ChatGPT-Yunzai<span class="version">${this.version}</span>`,
            //   pageGotoParams: {
            // waitUntil: "networkidle2",
            //   },
          };
        },
      }
    );

    return response;
  }
}
