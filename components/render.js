import Version from './version.js'
export default class Render {
  // TODO: Render in markdown format, and render responses that have image urls
  constructor () {
    this.imgTemplatePath = '/common/image-template/html'
    this.version = Version.version
    this.name = Version.name
  }

  async renderUrl (e, imgUrl) {
    if (!e.runtime) {
      console.log('e.runtime not found. Please update your Yunzai to latest.')
    }

    let data = {
      image_url: imgUrl,
      copyright: `Created by ChatGPT-Yunzai <span class="version">${this.version}</span>`
    }

    let response = await e.runtime.render(
      this.name,
      this.imgTemplatePath,
      data,
      {
        retType: 'default',
        beforeRender ({ data }) {
          return {
            ...data,
            sys: {
              scale: 1.4
            }
          }
        }
      }
    )

    return response
  }
}
