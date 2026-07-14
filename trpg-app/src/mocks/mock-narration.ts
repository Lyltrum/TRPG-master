// mock 模式下的假 AI 旁白——按玩家发的文本挑一条看起来相关的罐头文案，
// 只是为了让聊天室在没有真实 DeepSeek 调用时也能看到"有回复"的效果。

const OPENING_LINE =
  '铁门虚掩着，里面传来一股潮湿的木头和尘土气息。惠特利旧宅在暮色中沉默地矗立，你们的调查即将开始。'

const KEYWORD_REPLIES: Array<{ match: RegExp; replies: string[] }> = [
  {
    match: /调查|观察|检查/,
    replies: [
      '你仔细查看四周，注意到墙角有一些不寻常的划痕，像是被什么东西拖拽过。',
      '灰尘覆盖的地面上，隐约能看出几行凌乱的脚印，方向通向屋子深处。',
    ],
  },
  {
    match: /对话|交谈|问/,
    replies: [
      '对方沉默了片刻，眼神闪躲，似乎在犹豫要不要告诉你实情。',
      '"这件事……最好不要再问下去了。" 他压低声音说道。',
    ],
  },
  {
    match: /移动|前往|走|去/,
    replies: [
      '你们穿过昏暗的走廊，脚步声在空荡的房间里回响。',
      '推开门，一股冷风扑面而来，前方的房间比想象中更加深邃。',
    ],
  },
]

const FALLBACK_REPLIES = [
  '守秘人思考片刻，缓缓讲述接下来发生的事……（这是 mock 模式下的占位旁白）',
  '气氛变得微妙起来，似乎有什么东西正在暗中注视着你们。',
]

export function getOpeningNarration(): string {
  return OPENING_LINE
}

export function generateNarration(utterance: string): string {
  for (const group of KEYWORD_REPLIES) {
    if (group.match.test(utterance)) {
      return group.replies[Math.floor(Math.random() * group.replies.length)]
    }
  }
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]
}
