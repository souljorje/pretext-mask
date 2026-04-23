import type { MaskLayoutConfig } from '../lib'
import type { Point } from '../plugins'
import {
  createGlitchPlugin,
  createHoverColorPlugin,
  // createTypingPlugin,
  getGlitchBucket,
  type MaskRenderPlugin,
} from '../plugins'

export type StyleConfig = {
  baseColor: string
  accentColor: string
}

export type AnimationConfig = {
  hoverEnabled: boolean
  hoverRadius: number
  glitchEnabled: boolean
  glitchRate: number
  // typingEnabled: boolean
  // typingVisibleUntil: number
}

export type DemoPluginState = {
  pointer: Point | null
  seed: string
  glitchBucket: number | null
}

export function createDemoPlugins(
  layoutConfig: MaskLayoutConfig,
  styleConfig: StyleConfig,
  animationConfig: AnimationConfig,
  state: DemoPluginState,
): MaskRenderPlugin[] {
  const plugins: MaskRenderPlugin[] = []

  // if (animationConfig.typingEnabled) {
  //   plugins.push(createTypingPlugin(animationConfig.typingVisibleUntil))
  // }

  if (animationConfig.hoverEnabled) {
    plugins.push(
      createHoverColorPlugin({
        pointer: state.pointer,
        radius: animationConfig.hoverRadius,
        lineHeight: layoutConfig.lineHeight,
        baseColor: styleConfig.baseColor,
        accentColor: styleConfig.accentColor,
      }),
    )
  }

  if (animationConfig.glitchEnabled) {
    plugins.push(createGlitchPlugin({ seed: state.seed, bucket: state.glitchBucket }))
  }

  return plugins
}

export function getDemoGlitchBucket(animationConfig: AnimationConfig, timeMs: number): number | null {
  if (!animationConfig.glitchEnabled) return null
  return getGlitchBucket(animationConfig.glitchRate, timeMs)
}
