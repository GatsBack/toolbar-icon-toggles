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

// Marks every element this extension creates, so the picker can ignore
// clicks on its own UI (banner, tab, modal) while it's picking a target.
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

  // ---------------------------------------------------------------------
  // Base styles for the settings tab itself (not for hiding host icons —
  // that stylesheet is built separately in applyHideStyles()).
  // ---------------------------------------------------------------------
  const removeBaseStyle = ctx.dom.addStyle(`
    .tit-desc {
      color: var(--lumiverse-text-muted);
      font-size: 12.5px;
      line-height: 1.5;
      margin: 0 0 12px;
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
      margin-bottom: 14px;
    }
    .tit-add-btn:hover { border-color: var(--lumiverse-border-hover); }
    .tit-text-btn {
      background: none;
      border: none;
      color: var(--lumiverse-text-dim);
      font-size: 13px;
      cursor: pointer;
      padding: 7px 10px;
    }
    .tit-text-btn:hover { color: var(--lumiverse-text); }
    .tit-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--lumiverse-border);
      border-radius: var(--lumiverse-radius);
      margin-bottom: 8px;
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

  // ---------------------------------------------------------------------
  // Settings tab
  // ---------------------------------------------------------------------
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

  const addBtn = ctx.dom.createElement('button') as HTMLButtonElement
  addBtn.type = 'button'
  addBtn.className = 'tit-add-btn'
  addBtn.textContent = '+ Add icon'
  tab.root.appendChild(addBtn)

  const list = ctx.dom.createElement('div')
  tab.root.appendChild(list)

  function renderList() {
    for (const handle of mountedRowHandles) handle.destroy()
    mountedRowHandles = []
    list.replaceChildren()

    if (icons.length === 0) {
      const empty = ctx.dom.createElement('div')
      empty.className = 'tit-empty'
      empty.textContent = 'No icons managed yet.'
      list.appendChild(empty)
      return
    }

    for (const icon of icons) {
      const row = ctx.dom.createElement('div')
      row.className = 'tit-row'

      const label = ctx.dom.createElement('div')
      label.className = 'tit-row-label'
      label.textContent = icon.label
      label.title = icon.selector
      row.appendChild(label)

      const switchSlot = ctx.dom.createElement('div')
      const closeSlot = ctx.dom.createElement('div')

      // 1. MUST append row and slots to the DOM FIRST so Spindle recognizes the extension ownership
      row.appendChild(switchSlot)
      row.appendChild(closeSlot)
      list.appendChild(row)

      // 2. NOW mount components into the slots after they are in the DOM tree
      mountedRowHandles.push(
        ctx.components.mountSwitch(switchSlot, {
          checked: !icon.hidden,
          size: 'sm',
          ariaLabel: `Show ${icon.label}`,
          onChange: (visible: boolean) => {
            icon.hidden = !visible
            persist()
            applyHideStyles()
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
    }
  }

  // ---------------------------------------------------------------------
  // Hiding: one combined stylesheet, rebuilt whenever state changes.
  // Runs again on every extension load, so hidden icons stay hidden
  // across page refreshes.
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Picking: click any element on the page to register it.
  // ---------------------------------------------------------------------
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

    // Structural fallback: a short tag/position path up to the nearest
    // useful ancestor. Less stable across UI updates than the attribute
    // matches above, but works when no stable attribute exists.
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

    // Standard input fallback to guarantee clickability and value access
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
      e.stopPropagation()
      modal.dismiss()
    })
    actions.appendChild(cancelBtn)

    const saveBtn = ctx.dom.createElement('button') as HTMLButtonElement
    saveBtn.type = 'button'
    saveBtn.className = 'tit-add-btn'
    saveBtn.style.marginBottom = '0'
    saveBtn.style.cursor = 'pointer'
    saveBtn.style.pointerEvents = 'auto'
    saveBtn.textContent = 'Save'
    
    // Explicit click listener on the Save button
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const label = inputEl.value.trim() || 'Untitled icon'
      icons = [...icons, { id: crypto.randomUUID(), label, selector, hidden: false }]
      
      persist()
      renderList()
      modal.dismiss()
    })

    // Also support pressing 'Enter' inside the input field to save
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click()
      }
    })

    actions.appendChild(saveBtn)
  }

  addBtn.addEventListener('click', () => startPicking())

  // ---------------------------------------------------------------------
  // Load saved icons from the backend, then apply their hidden state.
  // ---------------------------------------------------------------------
  const unsubBackend = ctx.onBackendMessage((payload: any) => {
    if (payload?.type === 'loaded') {
      icons = Array.isArray(payload.icons) ? payload.icons : []
      renderList()
      applyHideStyles()
    }
  })
  ctx.sendToBackend({ type: 'load' })
  renderList() // show the empty state immediately while we wait on the backend

  // ---------------------------------------------------------------------
  // Bonus: a quick-access entry in the input bar's Extras popover that
  // jumps straight to the settings tab.
  // ---------------------------------------------------------------------
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