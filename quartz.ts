import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

import { withYomiContentIndex } from "./quartz/util/yomi-content-index"

const config = await loadQuartzConfig()
config.plugins.emitters = config.plugins.emitters.map((emitter) =>
  emitter.name === "ContentIndex" ? withYomiContentIndex(emitter) : emitter,
)
export default config
export const layout = await loadQuartzLayout()
