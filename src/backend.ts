declare const spindle: import('lumiverse-spindle-types').SpindleAPI

interface ManagedIcon {
  id: string
  label: string
  selector: string
  hidden: boolean
}

const ICONS_FILE = 'icons.json'

spindle.onFrontendMessage(async (payload: any, userId: string) => {
  switch (payload?.type) {
    case 'load': {
      const icons = await spindle.userStorage.getJson<ManagedIcon[]>(ICONS_FILE, {
        fallback: [],
        userId,
      })
      spindle.sendToFrontend({ type: 'loaded', icons }, userId)
      break
    }
    case 'save_icons': {
      const icons = Array.isArray(payload.icons) ? (payload.icons as ManagedIcon[]) : []
      await spindle.userStorage.setJson(ICONS_FILE, icons, { userId })
      break
    }
    default:
      break
  }
})

spindle.log.info('Toolbar Icon Toggles backend ready')
