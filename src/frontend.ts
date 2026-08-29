import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

interface ManagedIcon {
  id: string
  label: string
  selector: string
  hidden: boolean
}

interface MountedHandle {
  destroy: () => void
}

const OWNED_ATTR = 'data-tit-owned'
const FAB_POS_KEY = 'tit_fab_position'
const FAB_VISIBLE_KEY = 'tit_fab_visible'

const TAB_ICON_SVG =
  '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z" stroke="currentColor" stroke-width="1.5"/>' +
  '<path d="M10 7v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '</svg>'

const ACTION_ICON_SVG =
  '<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M2.5 7a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" stroke="currentColor" stroke-width="1.3"/>' +
  '<circle cx="7" cy="7" r="1.4" fill="currentColor"/>' +
  '</svg>'

export function setup(ctx: SpindleFrontendContext) {
  let icons: ManagedIcon[] = []
  let removeHideStyle: (() => void) | null = null
  let cancelPicking: (() => void) | null = null
  let mountedRowHandles: MountedHandle[] = []
  let mountedFabSwitchHandle: MountedHandle | null = null
  let searchQuery = ''
  let draggedIndex: number | null = null
  let isFabVisible = localStorage.getItem(FAB_VISIBLE_KEY) !== 'false'

  // ---------- Improved dynamic accent color detection ----------
  function updateDynamicAccentColor() {
    let color = ''

    // 1. Try to find the currently active/interactive element
    const activeSelectors = [
      '.active',
      '[aria-selected="true"]',
      '.selected',
      'button.primary',
      '[data-active="true"]',
      '.lumiverse-active',
      '.tab-active',
      '.nav-item.active'
    ]

    let activeEl: Element | null = null
    for (const sel of activeSelectors) {
      const el = document.querySelector(sel)
      if (el) {
        activeEl = el
        break
      }
    }

    if (activeEl) {
      const computed = window.getComputedStyle(activeEl)
      // Prefer background-color, fallback to color
      const bg = computed.backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        color = bg
      } else {
        color = computed.color
      }
    }

    // 2. If still no color, try reading Lumiverse's own accent variable
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      const rootStyles = window.getComputedStyle(document.documentElement)
      color = rootStyles.getPropertyValue('--lumiverse-primary').trim() ||
              rootStyles.getPropertyValue('--lumiverse-accent').trim() ||
              rootStyles.getPropertyValue('--color-primary').trim() ||
              rootStyles.getPropertyValue('--primary-color').trim() ||
              rootStyles.getPropertyValue('--accent-color').trim() ||
              rootStyles.getPropertyValue('--SmartThemeBodyColor').trim()
    }

    // 3. Ultimate fallback
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      color = '#a855f7' // default purple
    }

    document.documentElement.style.setProperty('--tit-theme-accent', color)
  }

  // Force an update right away
  updateDynamicAccentColor()

  // ---------- Broad observer with debounce ----------
  let accentDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const themeObserver = new MutationObserver(() => {
    if (accentDebounceTimer) clearTimeout(accentDebounceTimer)
    accentDebounceTimer = setTimeout(() => {
      updateDynamicAccentColor()
      accentDebounceTimer = null
    }, 200)
  })

  // Watch the entire body for structural changes and attribute updates
  themeObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'style', 'data-theme', 'data-state', 'aria-selected']
  })

  // Also re-check on window focus/resize (system theme changes)
  const onWindowFocus = () => updateDynamicAccentColor()
  const onWindowResize = () => updateDynamicAccentColor()
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('resize', onWindowResize)

  // ---------- Base styles (unchanged) ----------
  const removeBaseStyle = ctx.dom.addStyle(`
    .tit-desc {
      color: var(--lumiverse-text-muted, currentColor);
      font-size: 12.5px;
      line-height: 1.5;
      margin: 0 0 12px;
    }
    .tit-controls-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .tit-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      margin-bottom: 12px;
      border-radius: var(--lumiverse-radius, 6px);
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      background: var(--lumiverse-fill-subtle, transparent);
      font-size: 12.5px;
      color: var(--lumiverse-text, inherit);
    }
    .tit-sub-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    .tit-search-input {
      flex: 1;
      padding: 6px 10px;
      border-radius: var(--lumiverse-radius, 6px);
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      background: var(--lumiverse-fill, transparent);
      color: var(--lumiverse-text, inherit);
      font-size: 12.5px;
    }
    .tit-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--lumiverse-radius, 6px);
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      background: var(--lumiverse-fill, transparent);
      color: var(--lumiverse-text, inherit);
      font-size: 13px;
      cursor: pointer;
    }
    .tit-add-btn:hover { border-color: var(--lumiverse-border-hover, rgba(128,128,128,0.4)); }
    .tit-fab-btn {
      position: fixed;
	  
      z-index: 99999;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--tit-theme-accent, #a855f7);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
	  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      user-select: none;
      touch-action: none;
      transition: background 0.2s ease, transform 0.1s ease;
    }
    .tit-fab-btn:hover {
      filter: brightness(1.1);
    }
    .tit-fab-btn:active { cursor: grabbing; transform: scale(0.95); }
    .tit-toggle-all-box {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--lumiverse-text-muted, inherit);
    }
    .tit-text-btn {
      background: none;
      border: none;
      color: var(--lumiverse-text-dim, inherit);
      font-size: 13px;
      cursor: pointer;
      padding: 7px 10px;
    }
    .tit-text-btn:hover { color: var(--lumiverse-text, inherit); }
    .tit-icon-btn {
      background: none;
      border: none;
      color: var(--lumiverse-text-dim, inherit);
      font-size: 11px;
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .tit-icon-btn:hover {
      color: var(--lumiverse-text, inherit);
      background: var(--lumiverse-fill-hover, rgba(128,128,128,0.1));
    }
    .tit-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      border-radius: var(--lumiverse-radius, 6px);
      margin-bottom: 6px;
      background: var(--lumiverse-fill-subtle, transparent);
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .tit-row[draggable="true"] { cursor: grab; }
    .tit-row.tit-dragging { opacity: 0.4; cursor: grabbing; }
    .tit-row.tit-drag-over {
      border-color: var(--tit-theme-accent, #a855f7);
      background: var(--lumiverse-fill-hover, rgba(128,128,128,0.1));
    }
    .tit-drag-handle {
      color: var(--lumiverse-text-dim, inherit);
      font-size: 12px;
      padding: 0 4px;
      user-select: none;
      cursor: grab;
    }
    .tit-row-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--lumiverse-text, inherit);
      font-size: 13px;
    }
    .tit-empty {
      color: var(--lumiverse-text-dim, inherit);
      font-size: 13px;
      padding: 12px 4px;
    }
    .tit-pick-banner {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: var(--lumiverse-fill, #ffffff);
      border: 1px solid var(--tit-theme-accent, #a855f7);
      color: var(--lumiverse-text, inherit);
      padding: 10px 16px;
      border-radius: var(--lumiverse-radius, 6px);
      font-size: 13px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      user-select: none;
    }
    .tit-pick-hover {
      outline: 2px solid var(--tit-theme-accent, #a855f7) !important;
      outline-offset: 2px !important;
    }
    .tit-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
    }
  `)

  // ---------- Floating Action Button (FAB) ----------
  const fab = ctx.dom.createElement('button') as HTMLButtonElement
  fab.type = 'button'
  fab.className = 'tit-fab-btn'
  fab.textContent = '+'
  fab.title = 'Drag to move • Tap to pick icon'
  fab.setAttribute(OWNED_ATTR, '1')

  const savedPos = localStorage.getItem(FAB_POS_KEY)
  if (savedPos) {
    try {
      const { x, y } = JSON.parse(savedPos)
      fab.style.left = `${x}px`
      fab.style.top = `${y}px`
    } catch {
      fab.style.bottom = '20px'
      fab.style.right = '20px'
    }
  } else {
    fab.style.bottom = '20px'
    fab.style.right = '20px'
  }

  fab.style.display = isFabVisible ? 'flex' : 'none'
  document.body.appendChild(fab)

  let isDraggingFab = false
  let fabMoved = false
  let fabStartX = 0
  let fabStartY = 0
  let fabInitialLeft = 0
  let fabInitialTop = 0

  const onFabPointerDown = (e: PointerEvent) => {
    isDraggingFab = true
    fabMoved = false
    fabStartX = e.clientX
    fabStartY = e.clientY

    const rect = fab.getBoundingClientRect()
    fabInitialLeft = rect.left
    fabInitialTop = rect.top

    fab.style.bottom = 'auto'
    fab.style.right = 'auto'
    fab.style.left = `${fabInitialLeft}px`
    fab.style.top = `${fabInitialTop}px`

    fab.setPointerCapture(e.pointerId)
  }

  const onFabPointerMove = (e: PointerEvent) => {
    if (!isDraggingFab) return
    const dx = e.clientX - fabStartX
    const dy = e.clientY - fabStartY

    if (Math.hypot(dx, dy) > 4) {
      fabMoved = true
    }

    const newLeft = Math.max(0, Math.min(window.innerWidth - 44, fabInitialLeft + dx))
    const newTop = Math.max(0, Math.min(window.innerHeight - 44, fabInitialTop + dy))

    fab.style.left = `${newLeft}px`
    fab.style.top = `${newTop}px`
  }

  const onFabPointerUp = (e: PointerEvent) => {
    if (!isDraggingFab) return
    isDraggingFab = false
    fab.releasePointerCapture(e.pointerId)

    if (fabMoved) {
      const rect = fab.getBoundingClientRect()
      localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }))
    } else {
      startPicking()
    }
  }

  fab.addEventListener('pointerdown', onFabPointerDown)
  fab.addEventListener('pointermove', onFabPointerMove)
  fab.addEventListener('pointerup', onFabPointerUp)

  // ---------- Drawer tab ----------
  const tab = ctx.ui.registerDrawerTab({
    id: 'icon-toggles',
    title: 'Toolbar Icon Toggles',
    shortName: 'Icons',
    description: 'Show or hide any icon button in the app',
    keywords: ['toolbar', 'icons', 'hide', 'show', 'toggle', 'header', 'buttons'],
    headerTitle: 'Toolbar Icon Toggles',
    iconSvg: TAB_ICON_SVG,
  })
  tab.root.setAttribute(OWNED_ATTR, '1')

  const desc = ctx.dom.createElement('p')
  desc.className = 'tit-desc'
  desc.textContent =
    'Pick any icon button in the app and toggle whether it\u2019s shown. ' +
    'Click "Add icon" or tap the floating "+" button, then select the target icon.'
  tab.root.appendChild(desc)

  const fabSettingRow = ctx.dom.createElement('div')
  fabSettingRow.className = 'tit-setting-row'
  const fabSettingLabel = ctx.dom.createElement('span')
  fabSettingLabel.textContent = 'Show floating "+" button'
  fabSettingRow.appendChild(fabSettingLabel)
  const fabSwitchSlot = ctx.dom.createElement('div')
  fabSettingRow.appendChild(fabSwitchSlot)
  tab.root.appendChild(fabSettingRow)

  mountedFabSwitchHandle = ctx.components.mountSwitch(fabSwitchSlot, {
    checked: isFabVisible,
    size: 'sm',
    ariaLabel: 'Show floating add icon button',
    onChange: (visible: boolean) => {
      isFabVisible = visible
      localStorage.setItem(FAB_VISIBLE_KEY, String(visible))
      fab.style.display = isFabVisible ? 'flex' : 'none'
    },
  })

  const controlsHeader = ctx.dom.createElement('div')
  controlsHeader.className = 'tit-controls-header'
  tab.root.appendChild(controlsHeader)

  const addBtn = ctx.dom.createElement('button') as HTMLButtonElement
  addBtn.type = 'button'
  addBtn.className = 'tit-add-btn'
  addBtn.textContent = '+ Add icon'
  controlsHeader.appendChild(addBtn)

  const toggleAllBox = ctx.dom.createElement('div')
  toggleAllBox.className = 'tit-toggle-all-box'
  const toggleAllLabel = ctx.dom.createElement('span')
  toggleAllLabel.textContent = 'Toggle all'
  toggleAllBox.appendChild(toggleAllLabel)
  const toggleAllSlot = ctx.dom.createElement('div')
  toggleAllBox.appendChild(toggleAllSlot)
  controlsHeader.appendChild(toggleAllBox)

  const subControls = ctx.dom.createElement('div')
  subControls.className = 'tit-sub-controls'

  const searchInput = ctx.dom.createElement('input') as HTMLInputElement
  searchInput.type = 'text'
  searchInput.className = 'tit-search-input'
  searchInput.placeholder = 'Search toggles...'
  searchInput.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase()
    renderList()
  })
  subControls.appendChild(searchInput)

  const clearAllBtn = ctx.dom.createElement('button') as HTMLButtonElement
  clearAllBtn.type = 'button'
  clearAllBtn.className = 'tit-text-btn'
  clearAllBtn.textContent = 'Clear all'
  clearAllBtn.style.fontSize = '12px'
  clearAllBtn.addEventListener('click', async () => {
    const { confirmed } = await ctx.ui.showConfirm({
      title: 'Clear all icons?',
      message: 'Remove all managed icons? All buttons will return to visible.',
      variant: 'warning',
      confirmLabel: 'Clear All',
    })
    if (!confirmed) return
    icons = []
    persist()
    applyHideStyles()
    renderList()
  })
  subControls.appendChild(clearAllBtn)

  tab.root.appendChild(subControls)

  const list = ctx.dom.createElement('div')
  tab.root.appendChild(list)

  // ---------- Rendering and logic functions ----------
  function renderList() {
    // Force accent update when the list is rendered (user interaction)
    updateDynamicAccentColor()

    for (const handle of mountedRowHandles) handle.destroy()
    mountedRowHandles = []
    list.replaceChildren()

    toggleAllSlot.replaceChildren()
    if (icons.length > 0) {
      const allVisible = icons.every((i) => !i.hidden)
      mountedRowHandles.push(
        ctx.components.mountSwitch(toggleAllSlot, {
          checked: allVisible,
          size: 'sm',
          ariaLabel: 'Toggle visibility of all icons',
          onChange: (visible: boolean) => {
            icons.forEach((i) => (i.hidden = !visible))
            persist()
            applyHideStyles()
            renderList()
          },
        })
      )
      toggleAllBox.style.display = 'flex'
      subControls.style.display = 'flex'
    } else {
      toggleAllBox.style.display = 'none'
      subControls.style.display = 'none'
    }

    const filteredIcons = icons.filter((i) => i.label.toLowerCase().includes(searchQuery))

    if (filteredIcons.length === 0) {
      const empty = ctx.dom.createElement('div')
      empty.className = 'tit-empty'
      empty.textContent = icons.length === 0 ? 'No icons managed yet.' : 'No matching icons found.'
      list.appendChild(empty)
      return
    }

    filteredIcons.forEach((icon) => {
      const realIndex = icons.findIndex((i) => i.id === icon.id)

      const row = ctx.dom.createElement('div')
      row.className = 'tit-row'

      if (!searchQuery) {
        row.draggable = true

        const dragHandle = ctx.dom.createElement('span')
        dragHandle.className = 'tit-drag-handle'
        dragHandle.textContent = '⋮⋮'
        dragHandle.title = 'Drag to reorder'
        row.appendChild(dragHandle)

        row.addEventListener('dragstart', (e) => {
          draggedIndex = realIndex
          row.classList.add('tit-dragging')
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move'
          }
        })

        row.addEventListener('dragend', () => {
          draggedIndex = null
          row.classList.remove('tit-dragging')
          document.querySelectorAll('.tit-row').forEach((r) => r.classList.remove('tit-drag-over'))
        })

        row.addEventListener('dragover', (e) => {
          e.preventDefault()
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move'
          }
          row.classList.add('tit-drag-over')
        })

        row.addEventListener('dragleave', () => {
          row.classList.remove('tit-drag-over')
        })

        row.addEventListener('drop', (e) => {
          e.preventDefault()
          row.classList.remove('tit-drag-over')
          if (draggedIndex === null || draggedIndex === realIndex) return

          const [movedItem] = icons.splice(draggedIndex, 1)
          icons.splice(realIndex, 0, movedItem)
          draggedIndex = null

          persist()
          renderList()
        })
      }

      const label = ctx.dom.createElement('div')
      label.className = 'tit-row-label'
      label.textContent = icon.label
      label.title = icon.selector
      row.appendChild(label)

      const editBtn = ctx.dom.createElement('button') as HTMLButtonElement
      editBtn.type = 'button'
      editBtn.className = 'tit-icon-btn'
      editBtn.title = 'Rename icon'
      editBtn.textContent = '✏️'
      editBtn.addEventListener('click', () => openRenameModal(icon))
      row.appendChild(editBtn)

      const switchSlot = ctx.dom.createElement('div')
      const closeSlot = ctx.dom.createElement('div')

      row.appendChild(switchSlot)
      row.appendChild(closeSlot)
      list.appendChild(row)

      mountedRowHandles.push(
        ctx.components.mountSwitch(switchSlot, {
          checked: !icon.hidden,
          size: 'sm',
          ariaLabel: `Show ${icon.label}`,
          onChange: (visible: boolean) => {
            icon.hidden = !visible
            persist()
            applyHideStyles()
            renderList()
          },
        })
      )

      mountedRowHandles.push(
        ctx.components.mountCloseButton(closeSlot, {
          size: 'sm',
          variant: 'subtle',
          onClick: async () => {
            const { confirmed } = await ctx.ui.showConfirm({
              title: 'Remove icon',
              message: `Stop managing "${icon.label}"? It will become permanently visible again.`,
              variant: 'warning',
              confirmLabel: 'Remove',
            })
            if (!confirmed) return
            icons = icons.filter((i) => i.id !== icon.id)
            persist()
            applyHideStyles()
            renderList()
          },
        })
      )
    })
  }

  function applyHideStyles() {
    removeHideStyle?.()
    removeHideStyle = null
    const hiddenSelectors = icons.filter((i) => i.hidden).map((i) => i.selector)
    if (hiddenSelectors.length === 0) return
    const css = hiddenSelectors.map((s) => `${s} { display: none !important; }`).join('\n')
    removeHideStyle = ctx.dom.addStyle(css)
  }

  function persist() {
    ctx.sendToBackend({ type: 'save_icons', icons })
  }

  function defaultLabel(el: Element): string {
    const candidate =
      el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim()
    return (candidate || 'Untitled icon').slice(0, 60)
  }

  function buildSelector(el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`

    for (const attr of ['aria-label', 'data-testid', 'title', 'name']) {
      const val = el.getAttribute(attr)
      if (val) return `${el.tagName.toLowerCase()}[${attr}="${val.replace(/"/g, '\\"')}"]`
    }

    const path: string[] = []
    let node: Element | null = el
    for (let depth = 0; depth < 5 && node && node !== document.body; depth++) {
      let piece = node.tagName.toLowerCase()
      const parent: Element | null = node.parentElement
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName)
        if (sameTag.length > 1) piece += `:nth-of-type(${sameTag.indexOf(node) + 1})`
      }
      path.unshift(piece)
      node = parent
    }
    return path.join(' > ')
  }

  function findPickable(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null
    if (target.closest(`[${OWNED_ATTR}]`)) return null
    const interactive = target.closest('button, a, [role="button"], summary') as HTMLElement | null
    return interactive || (target as HTMLElement)
  }

  function startPicking() {
    if (cancelPicking) return

    setTimeout(() => {
      ctx.ui.closeDrawer()
    }, 50)

    fab.style.display = 'none'

    const banner = ctx.dom.inject(
      'body',
      `<div class="tit-pick-banner" ${OWNED_ATTR}="1">Tap target icon to toggle \u2014 Tap here to cancel</div>`,
      'beforeend'
    )

    let hovered: HTMLElement | null = null

    const onOver = (e: MouseEvent) => {
      const el = findPickable(e.target)
      if (el === hovered) return
      hovered?.classList.remove('tit-pick-hover')
      hovered = el
      hovered?.classList.add('tit-pick-hover')
    }

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      
      if (target?.closest('.tit-pick-banner')) {
        e.preventDefault()
        e.stopPropagation()
        finish(null)
        return
      }

      const el = findPickable(e.target)
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      finish(el)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(null)
    }

    setTimeout(() => {
      document.addEventListener('mouseover', onOver, true)
      document.addEventListener('click', onClick, true)
      document.addEventListener('keydown', onKey, true)
    }, 150)

    function finish(el: HTMLElement | null) {
      hovered?.classList.remove('tit-pick-hover')
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
      ctx.dom.uninject(banner)
      fab.style.display = isFabVisible ? 'flex' : 'none'
      cancelPicking = null

      if (el) {
        openNamingModal(el)
      } else {
        tab.activate()
        // Force accent update after the drawer opens
        setTimeout(() => updateDynamicAccentColor(), 300)
      }
    }

    cancelPicking = () => finish(null)
  }

  function openNamingModal(el: HTMLElement) {
    const selector = buildSelector(el)
    const modal = ctx.ui.showModal({ title: 'Name this icon' })
    modal.root.setAttribute(OWNED_ATTR, '1')

    const hint = ctx.dom.createElement('p')
    hint.className = 'tit-desc'
    hint.textContent = 'Give this icon a label so you can find it in your list later.'
    modal.root.appendChild(hint)

    const inputSlot = ctx.dom.createElement('div')
    modal.root.appendChild(inputSlot)

    const inputEl = ctx.dom.createElement('input') as HTMLInputElement
    inputEl.type = 'text'
    inputEl.value = defaultLabel(el)
    inputEl.placeholder = 'e.g. Home button'
    inputEl.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--lumiverse-radius, 6px);
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      background: var(--lumiverse-fill, transparent);
      color: var(--lumiverse-text, inherit);
      font-size: 13px;
      box-sizing: border-box;
      margin-bottom: 12px;
    `
    inputSlot.appendChild(inputEl)
    setTimeout(() => inputEl.focus(), 50)

    const actions = ctx.dom.createElement('div')
    actions.className = 'tit-modal-actions'
    modal.root.appendChild(actions)

    const cancelBtn = ctx.dom.createElement('button') as HTMLButtonElement
    cancelBtn.type = 'button'
    cancelBtn.className = 'tit-text-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault()
      modal.dismiss()
      tab.activate()
      setTimeout(() => updateDynamicAccentColor(), 300)
    })
    actions.appendChild(cancelBtn)

    const saveBtn = ctx.dom.createElement('button') as HTMLButtonElement
    saveBtn.type = 'button'
    saveBtn.className = 'tit-add-btn'
    saveBtn.style.marginBottom = '0'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault()
      const label = inputEl.value.trim() || 'Untitled icon'
      icons = [...icons, { id: crypto.randomUUID(), label, selector, hidden: false }]
      persist()
      renderList()
      modal.dismiss()
      tab.activate()
      setTimeout(() => updateDynamicAccentColor(), 300)
    })

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click()
    })

    actions.appendChild(saveBtn)
  }

  function openRenameModal(icon: ManagedIcon) {
    const modal = ctx.ui.showModal({ title: 'Rename icon' })
    modal.root.setAttribute(OWNED_ATTR, '1')

    const inputSlot = ctx.dom.createElement('div')
    modal.root.appendChild(inputSlot)

    const inputEl = ctx.dom.createElement('input') as HTMLInputElement
    inputEl.type = 'text'
    inputEl.value = icon.label
    inputEl.placeholder = 'Icon label'
    inputEl.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--lumiverse-radius, 6px);
      border: 1px solid var(--lumiverse-border, rgba(128,128,128,0.2));
      background: var(--lumiverse-fill, transparent);
      color: var(--lumiverse-text, inherit);
      font-size: 13px;
      box-sizing: border-box;
      margin-bottom: 12px;
    `
    inputSlot.appendChild(inputEl)
    setTimeout(() => inputEl.focus(), 50)

    const actions = ctx.dom.createElement('div')
    actions.className = 'tit-modal-actions'
    modal.root.appendChild(actions)

    const cancelBtn = ctx.dom.createElement('button') as HTMLButtonElement
    cancelBtn.type = 'button'
    cancelBtn.className = 'tit-text-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault()
      modal.dismiss()
    })
    actions.appendChild(cancelBtn)

    const saveBtn = ctx.dom.createElement('button') as HTMLButtonElement
    saveBtn.type = 'button'
    saveBtn.className = 'tit-add-btn'
    saveBtn.style.marginBottom = '0'
    saveBtn.textContent = 'Save'
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault()
      const newLabel = inputEl.value.trim() || icon.label
      icon.label = newLabel
      persist()
      renderList()
      modal.dismiss()
    })

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click()
    })

    actions.appendChild(saveBtn)
  }

  addBtn.addEventListener('click', () => startPicking())

  const unsubBackend = ctx.onBackendMessage((payload: any) => {
    if (payload?.type === 'loaded') {
      icons = Array.isArray(payload.icons) ? payload.icons : []
      renderList()
      applyHideStyles()
    }
  })
  ctx.sendToBackend({ type: 'load' })
  renderList()

  const quickAction = ctx.ui.registerInputBarAction({
    id: 'open-icon-toggles',
    label: 'Toolbar Icon Toggles',
    iconSvg: ACTION_ICON_SVG,
  })
  const unsubAction = quickAction.onClick(() => {
    tab.activate()
    setTimeout(() => updateDynamicAccentColor(), 300)
  })

  // ---------- Cleanup ----------
  return () => {
    themeObserver.disconnect()
    if (accentDebounceTimer) clearTimeout(accentDebounceTimer)
    window.removeEventListener('focus', onWindowFocus)
    window.removeEventListener('resize', onWindowResize)
    cancelPicking?.()
    unsubBackend()
    unsubAction()
    quickAction.destroy()
    mountedFabSwitchHandle?.destroy()
    fab.removeEventListener('pointerdown', onFabPointerDown)
    fab.removeEventListener('pointermove', onFabPointerMove)
    fab.removeEventListener('pointerup', onFabPointerUp)
    fab.remove()
    for (const handle of mountedRowHandles) handle.destroy()
    removeHideStyle?.()
    removeBaseStyle()
    tab.destroy()
    ctx.dom.cleanup()
  }
}