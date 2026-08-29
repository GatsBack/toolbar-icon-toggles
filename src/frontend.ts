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
  let searchQuery = ''

  const removeBaseStyle = ctx.dom.addStyle(`
    .tit-desc {
      color: var(--lumiverse-text-muted);
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
      border-radius: var(--lumiverse-radius);
      border: 1px solid var(--lumiverse-border);
      background: var(--lumiverse-fill);
      color: var(--lumiverse-text);
      font-size: 12.5px;
    }
    .tit-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--lumiverse-radius);
      border: 1px solid var(--lumiverse-border);
      background: var(--lumiverse-fill);
      color: var(--lumiverse-text);
      font-size: 13px;
      cursor: pointer;
    }
    .tit-add-btn:hover { border-color: var(--lumiverse-border-hover); }
    .tit-toggle-all-box {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--lumiverse-text-muted);
    }
    .tit-text-btn {
      background: none;
      border: none;
      color: var(--lumiverse-text-dim);
      font-size: 13px;
      cursor: pointer;
      padding: 7px 10px;
    }
    .tit-text-btn:hover { color: var(--lumiverse-text); }
    .tit-icon-btn {
      background: none;
      border: none;
      color: var(--lumiverse-text-dim);
      font-size: 11px;
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .tit-icon-btn:hover {
      color: var(--lumiverse-text);
      background: var(--lumiverse-fill-hover);
    }
    .tit-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: 1px solid var(--lumiverse-border);
      border-radius: var(--lumiverse-radius);
      margin-bottom: 6px;
      background: var(--lumiverse-fill-subtle);
    }
    .tit-row-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--lumiverse-text);
      font-size: 13px;
    }
    .tit-reorder-group {
      display: flex;
      gap: 2px;
    }
    .tit-empty {
      color: var(--lumiverse-text-dim);
      font-size: 13px;
      padding: 12px 4px;
    }
    .tit-pick-banner {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: var(--lumiverse-fill);
      border: 1px solid var(--lumiverse-accent);
      color: var(--lumiverse-text);
      padding: 10px 16px;
      border-radius: var(--lumiverse-radius);
      font-size: 13px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    }
    .tit-pick-hover {
      outline: 2px solid var(--lumiverse-accent) !important;
      outline-offset: 2px !important;
    }
    .tit-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
    }
  `)

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
    'Click "Add icon", then click the real icon you want to manage.'
  tab.root.appendChild(desc)

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

  // Sub-controls: Search & Clear All
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

  function moveIcon(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= icons.length) return
    const temp = icons[index]
    icons[index] = icons[targetIndex]
    icons[targetIndex] = temp
    persist()
    renderList()
  }

  function renderList() {
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

      // Reorder buttons (⬆️ / ⬇️)
      const reorderGroup = ctx.dom.createElement('div')
      reorderGroup.className = 'tit-reorder-group'

      if (realIndex > 0) {
        const upBtn = ctx.dom.createElement('button') as HTMLButtonElement
        upBtn.type = 'button'
        upBtn.className = 'tit-icon-btn'
        upBtn.textContent = '▲'
        upBtn.title = 'Move up'
        upBtn.addEventListener('click', () => moveIcon(realIndex, -1))
        reorderGroup.appendChild(upBtn)
      }

      if (realIndex < icons.length - 1) {
        const downBtn = ctx.dom.createElement('button') as HTMLButtonElement
        downBtn.type = 'button'
        downBtn.className = 'tit-icon-btn'
        downBtn.textContent = '▼'
        downBtn.title = 'Move down'
        downBtn.addEventListener('click', () => moveIcon(realIndex, 1))
        reorderGroup.appendChild(downBtn)
      }

      row.appendChild(reorderGroup)

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

    const banner = ctx.dom.inject(
      'body',
      `<div class="tit-pick-banner" ${OWNED_ATTR}="1">Click the icon you want to toggle \u2014 Esc to cancel</div>`,
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

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)

    function finish(el: HTMLElement | null) {
      hovered?.classList.remove('tit-pick-hover')
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
      ctx.dom.uninject(banner)
      cancelPicking = null
      if (el) openNamingModal(el)
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
      border-radius: var(--lumiverse-radius);
      border: 1px solid var(--lumiverse-border);
      background: var(--lumiverse-fill);
      color: var(--lumiverse-text);
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
      const label = inputEl.value.trim() || 'Untitled icon'
      icons = [...icons, { id: crypto.randomUUID(), label, selector, hidden: false }]
      persist()
      renderList()
      modal.dismiss()
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
      border-radius: var(--lumiverse-radius);
      border: 1px solid var(--lumiverse-border);
      background: var(--lumiverse-fill);
      color: var(--lumiverse-text);
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
  const unsubAction = quickAction.onClick(() => tab.activate())

  return () => {
    cancelPicking?.()
    unsubBackend()
    unsubAction()
    quickAction.destroy()
    for (const handle of mountedRowHandles) handle.destroy()
    removeHideStyle?.()
    removeBaseStyle()
    tab.destroy()
    ctx.dom.cleanup()
  }
}