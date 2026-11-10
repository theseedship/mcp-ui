/** Standalone Chromium regression runner; all browser tooling is externally supplied. */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '../..')
const sourceRoot = resolve(process.env.MCP_THEME_SOURCE_ROOT || resolve(packageRoot, 'src'))
const require = createRequire(resolve(packageRoot, 'package.json'))
const externalRoot = process.env.MCP_THEME_BROWSER_DEPS
if (!externalRoot) throw new Error('Set MCP_THEME_BROWSER_DEPS to a node_modules directory containing playwright and @tailwindcss/vite (no project dependency changes needed).')
const externalRequire = createRequire(resolve(externalRoot, '../package.json'))
const load = async path => import(pathToFileURL(path).href)
const { createServer } = await load(require.resolve('vite'))
const { default: solid } = await import('@solidjs/vite-plugin')
const { default: tailwind } = await load(externalRequire.resolve('@tailwindcss/vite'))
const playwright = await load(externalRequire.resolve('playwright'))
const { chromium } = playwright.default || playwright
const tailwindCss = externalRequire.resolve('tailwindcss/index.css')
const server = await createServer({
  configFile: false, root: here,
  plugins: [{name:'theme-fixture-source',enforce:'pre',transform(code,id) {
    if (id === resolve(here,'fixture.css')) return code.replaceAll('SOURCE_ROOT', sourceRoot)
  }}, solid(), ...tailwind()],
  resolve: {conditions:['browser','development'], alias: {'theme-source':sourceRoot, 'tailwindcss':tailwindCss,'@seed-ship/mcp-ui-spec':resolve(sourceRoot,'../../mcp-ui-spec/src/index.ts')}, dedupe:['solid-js','@solidjs/web','@solidjs/signals']},
  server: {host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/baseline-6.24.0.json']},fs:{allow:[resolve(packageRoot,'..'),resolve(sourceRoot,'../..'),externalRoot]}},
})
const browser = await chromium.launch({headless:true, ...(process.env.MCP_THEME_CHROMIUM ? {executablePath:process.env.MCP_THEME_CHROMIUM}: {})})
const selectors = {
  prompt:'#prompt [role="dialog"]', promptTitle:'#prompt p', promptChoice:'#prompt button.text-left',
  table:'#table table', tableHead:'#table th', tableCell:'#table td', tableSearch:'#table input',
  expandButton:'#expand [data-mcp-ui-action="expand"]', scratchpad:'#scratchpad > div',
  autocomplete:'.mcp-autocomplete-dropdown', autocompleteSelected:'.mcp-autocomplete-option-selected',
  autocompleteLabel:'.mcp-autocomplete-option-label', autocompleteHighlight:'.mcp-autocomplete-highlight',
  form:'#form [role="dialog"]', formLabel:'#form label', requiredMarker:'#form label span[aria-hidden]',
  requiredInput:'#field-required-title', formSelect:'#field-report-kind', formHelp:'#form .space-y-1 p',
  disabledSubmit:'#form button[type="submit"]', errorInput:'#field-invalid-title', errorText:'#invalid-title-error',
  scratchpadSelect:'#field-pad-kind', scratchpadFilter:'#scratchpad button.border-dashed',
}
const props=['color','backgroundColor','borderTopColor','boxShadow','outlineColor']
const errors=[]
try {
  await server.listen()
  const url=server.resolvedUrls.local[0]
  console.log(`Theme fixture ready: ${url}`)
  const page=await browser.newPage({viewport:{width:1280,height:1000},colorScheme:'light'})
  page.on('pageerror', error => { errors.push(error.message); console.error('Fixture browser error:',error.message) })
  page.on('console', message => {
    if (/\[(?:STRICT_READ_UNTRACKED|NO_OWNER_EFFECT|REACTIVE_WRITE_IN_OWNED_SCOPE|HYDRATION[^\]]*)\]/.test(message.text())) {
      errors.push(message.text())
    }
  })
  page.setDefaultTimeout(15000)
  await page.goto(url,{waitUntil:'domcontentloaded'})
  console.log('Theme fixture loaded')
  await page.locator('#prompt [role="dialog"]').waitFor()
  if (process.env.MCP_THEME_DEBUG) console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('style')).map(s=>({length:s.textContent.length,hasWhite:s.textContent.includes('.bg-white'),start:s.textContent.slice(0,180)}))))
  const snapshot=async (selection=selectors) => {
    await page.waitForTimeout(250)
    return page.evaluate(({selection,props}) => Object.fromEntries(Object.entries(selection).map(([key,selector]) => {
      const element=document.querySelector(selector)
      if (!element) throw new Error(`Missing fixture selector: ${key} ${selector}`)
      const style=getComputedStyle(element)
      return [key,Object.fromEntries(props.map(property=>[property,style[property]]))]
    })), {selection,props})
  }
  const samples={}
  const contrast={}
  const controlContrast={}
  const measureControls=async (selection,focused=false)=>page.evaluate(({selection,focused})=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    const luminance=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0)
    return Object.fromEntries(Object.entries(selection).map(([name,selector])=>{
      const element=document.querySelector(selector),style=getComputedStyle(element),ancestors=[]
      for(let current=element.parentElement;current;current=current.parentElement) ancestors.unshift(current)
      const paintBackground=()=>{
        ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1)
        for(const ancestor of ancestors){ctx.fillStyle=getComputedStyle(ancestor).backgroundColor;ctx.fillRect(0,0,1,1)}
      }
      paintBackground()
      const adjacent=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)
      const measure=color=>{
        paintBackground();ctx.fillStyle=color;ctx.fillRect(0,0,1,1)
        const foreground=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)
        const a=luminance(foreground),b=luminance(adjacent)
        return {color,foreground,adjacent,ratio:Number(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2))}
      }
      const borderVisible=style.borderTopStyle!=='none'&&parseFloat(style.borderTopWidth)>0
      const result={disabled:element.disabled||false,border:{visible:borderVisible,width:style.borderTopWidth,...measure(style.borderTopColor)}}
      if(focused){
        const ring=style.getPropertyValue('--tw-ring-color').trim()
        result.focused=document.activeElement===element
        result.ring={visible:!!ring&&style.boxShadow!=='none',boxShadow:style.boxShadow,...(ring?measure(ring):{})}
        result.outline={visible:style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0,width:style.outlineWidth,style:style.outlineStyle,...measure(style.outlineColor)}
      }
      return[name,result]
    }))
  },{selection,focused})
  for (const dark of [false,true]) {
    await page.evaluate(dark=>{
      document.documentElement.classList.toggle('dark',dark)
      // Closing the previous mode's dialog restores its trigger's focus.
      // Default samples must not inherit that intentional focus state.
      if(document.activeElement instanceof HTMLElement) document.activeElement.blur()
    },dark)
    assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,'Default theme samples must start without inherited control focus')
    samples[dark?'dark':'light']=await snapshot()
    controlContrast[dark?'dark':'light']={default:await measureControls({requiredInput:selectors.requiredInput,formSelect:selectors.formSelect,scratchpadSelect:selectors.scratchpadSelect,tableSearch:selectors.tableSearch,choice:selectors.promptChoice})}
    contrast[dark?'dark':'light']=await page.evaluate(selection=>{
      const canvas=document.createElement('canvas')
      canvas.width=canvas.height=1
      const ctx=canvas.getContext('2d',{willReadFrequently:true})
      const luminance=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0)
      return Object.fromEntries(Object.entries(selection).map(([name,selector])=>{
        const element=document.querySelector(selector)
        const ancestors=[]
        for(let current=element;current;current=current.parentElement) ancestors.unshift(current)
        ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1)
        for(const ancestor of ancestors){ctx.fillStyle=getComputedStyle(ancestor).backgroundColor;ctx.fillRect(0,0,1,1)}
        const background=Array.from(ctx.getImageData(0,0,1,1).data)
        ctx.fillStyle=getComputedStyle(element).color;ctx.fillRect(0,0,1,1)
        const foreground=Array.from(ctx.getImageData(0,0,1,1).data)
        const a=luminance(foreground),b=luminance(background)
        return[name,{ratio:Number(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2)),foreground:foreground.slice(0,3),background:background.slice(0,3)}]
      }))
    },{promptTitle:selectors.promptTitle,formLabel:selectors.formLabel,formHelp:selectors.formHelp,requiredInput:selectors.requiredInput,scratchpadSelect:selectors.scratchpadSelect,autocompleteLabel:selectors.autocompleteLabel,autocompleteHighlight:selectors.autocompleteHighlight})
    await page.locator('#field-required-title').focus()
    samples[dark?'darkFocus':'lightFocus']=await snapshot({requiredInput:'#field-required-title'})
    controlContrast[dark?'dark':'light'].focus=await measureControls({requiredInput:selectors.requiredInput},true)
    await page.locator('#field-required-title').blur()
    await page.locator('#field-invalid-title').focus()
    samples[dark?'darkErrorFocus':'lightErrorFocus']=await snapshot({errorInput:'#field-invalid-title'})
    controlContrast[dark?'dark':'light'].errorFocus=await measureControls({errorInput:selectors.errorInput},true)
    await page.locator('#field-invalid-title').blur()
    await page.locator('#prompt button.text-left').first().hover()
    samples[dark?'darkChoiceHover':'lightChoiceHover']=await snapshot({choice:'#prompt button.text-left'})
    await page.mouse.move(1200,1)
    await page.locator('#scratchpad button.border-dashed').evaluate(element=>element.click())
    samples[dark?'darkFilterOpen':'lightFilterOpen']=await snapshot({panel:'#scratchpad .min-w-\\[200px\\]',option:'#scratchpad .min-w-\\[200px\\] .max-h-48 button'})
    await page.getByRole('button',{name:'Brief filter',exact:true}).evaluate(element=>element.click())
    await page.locator('#menu-trigger').evaluate(element=>element.click())
    samples[dark?'darkMenu':'lightMenu']=await snapshot({menu:'[data-mcp-ui-portal="menu"]'})
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',!dark),dark)
    samples[dark?'darkMenuToggledLight':'lightMenuToggledDark']=await snapshot({menu:'[data-mcp-ui-portal="menu"]'})
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark)
    await page.keyboard.press('Escape')
    await page.locator('#expand [data-mcp-ui-action="expand"]').evaluate(element=>element.click())
    samples[dark?'darkDialog':'lightDialog']=await snapshot({dialog:'[data-mcp-ui-portal="dialog"]',panel:'[data-mcp-ui-portal="dialog"] > div',title:'[data-mcp-ui-portal="dialog"] h2'})
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',!dark),dark)
    samples[dark?'darkDialogToggledLight':'lightDialogToggledDark']=await snapshot({dialog:'[data-mcp-ui-portal="dialog"]',panel:'[data-mcp-ui-portal="dialog"] > div',title:'[data-mcp-ui-portal="dialog"] h2'})
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark)
    await page.keyboard.press('Escape')
  }
  assert.notEqual(samples.light.prompt.backgroundColor,'rgba(0, 0, 0, 0)','Tailwind fixture CSS did not apply')
  assert.notEqual(samples.light.prompt.backgroundColor,samples.dark.prompt.backgroundColor,'Class-based dark utilities did not apply')
  assert.notEqual(samples.light.promptTitle.color,samples.dark.promptTitle.color,'Dark text utilities did not apply')
  assert.deepEqual(errors,[],`Browser errors: ${errors.join('\n')}`)
  const chartModule=await readFile(require.resolve('chart.js'),'utf8')
  const paletteBlock=chartModule.match(/const BORDER_COLORS = \[([\s\S]*?)\];/)
  assert.ok(paletteBlock,'Installed Chart.js default palette could not be resolved for supplementary contrast report')
  const chartColors=Array.from(paletteBlock[1].matchAll(/'(rgb\([^']+\))'/g),match=>match[1])
  const chartPalette=await page.evaluate(colors=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    const lum=rgb=>rgb.slice(0,3).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0)
    const measure=color=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Number((1.05/(lum(Array.from(ctx.getImageData(0,0,1,1).data))+0.05)).toFixed(2))}
    return colors.map(color=>({color,opaqueOnWhite:measure(color),halfAlphaOnWhite:measure(color.replace('rgb(','rgba(').replace(')',', 0.5)'))}))
  },chartColors)
  const chartVersion=JSON.parse(await readFile(resolve(dirname(require.resolve('chart.js')),'../package.json'),'utf8')).version
  const output={identity:{commit:execFileSync('git',['-C',sourceRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),tailwind:externalRequire('tailwindcss/package.json').version},samples,contrast,controlContrast,chartPalette:{version:chartVersion,background:'white',measurements:chartPalette,scope:'Supplementary engine Colors-plugin palette only; no rendered chart, series adjacency, or host canvas validation'}}
  console.log('Text/control contrast ratios:',JSON.stringify(Object.fromEntries(Object.entries(contrast).map(([mode,pairs])=>[mode,Object.fromEntries(Object.entries(pairs).map(([name,result])=>[name,result.ratio]))]))))
  console.log('Control boundary/focus contrast:',JSON.stringify(Object.fromEntries(Object.entries(controlContrast).map(([mode,groups])=>[mode,{borders:Object.fromEntries(Object.entries(groups.default).map(([name,result])=>[name,result.border.ratio])),focusRing:groups.focus.requiredInput.ring.ratio,focusOutline:groups.focus.requiredInput.outline.ratio,errorFocusRing:groups.errorFocus.errorInput.ring.ratio}]))))
  console.log('Supplementary Chart.js palette on white:',JSON.stringify(chartPalette))
  const baselinePath=resolve(here,'baseline-6.24.0.json')
  if (process.argv.includes('--capture')) {
    assert.equal(output.identity.commit,'54e100d5dec1af8cea7673537f399b4f696b151b','Only the immutable 6.24.0 commit can write the baseline')
    execFileSync('git',['-C',sourceRoot,'diff','--exit-code','HEAD','--','.'],{stdio:'pipe'})
    await writeFile(baselinePath,JSON.stringify(output,null,2)+'\n')
    console.log(`Captured ${Object.keys(samples).length} Chromium samples from ${output.identity.commit}`)
  } else {
    const baseline=JSON.parse(await readFile(baselinePath,'utf8'))
    if (process.env.MCP_THEME_RESULT_PATH) await writeFile(process.env.MCP_THEME_RESULT_PATH,JSON.stringify(output,null,2)+'\n')
    assert.deepEqual(samples,baseline.samples,'Default colors differ from the frozen 6.24.0 browser baseline')
    assert.deepEqual(controlContrast,baseline.controlContrast,'Default control-boundary/focus contrast differs from the frozen 6.24.0 baseline')
    console.log(`PASS: ${Object.keys(samples).length} computed-style samples match 6.24.0 (${baseline.identity.commit})`)
    if (process.argv.includes('--host')) {
      const surface='rgb(23, 37, 53)', fg='rgb(203, 217, 229)', border='rgb(107, 127, 149)', accent='rgb(169, 83, 137)'
      const muted='rgb(151, 167, 181)', controlBorder='rgb(137, 103, 83)', focus='rgb(193, 151, 53)', hover='rgb(43, 59, 71)', shadow='rgb(7, 9, 11) 2px 3px 4px 1px'
      await page.evaluate(({surface,fg,border,accent,muted,controlBorder,focus,hover,shadow})=>{
        document.documentElement.classList.remove('dark')
        const host=document.querySelector('#theme-host')
        host.classList.remove('dark')
        for(const [name,value] of Object.entries({surface,fg,border,accent,shadow,focus,'fg-muted':muted,'fg-subtle':muted,'border-control':controlBorder,'surface-hover':hover,'surface-muted':surface,'accent-soft':surface,'accent-fg':fg})) host.style.setProperty(`--mcp-ui-${name}`,value)
      },{surface,fg,border,accent,muted,controlBorder,focus,hover,shadow})
      for(const selector of ['#field-required-title','#field-theme-notes','#field-theme-basic','#field-theme-completion']) {
        const control=page.locator(selector)
        await control.fill('Typed host-themed text')
        assert.equal(await control.evaluate(element=>getComputedStyle(element).color),fg,`${selector} ignores host foreground without a dark class`)
        await control.fill('')
        await control.blur()
      }
      assert.equal(await page.locator('#field-theme-completion').getAttribute('aria-autocomplete'),'list','Autocomplete-enabled branch was not exercised')
      const mutedInput=page.locator('#field-theme-muted')
      assert.equal(await mutedInput.evaluate(element=>getComputedStyle(element).color),muted,'Normal input foreground overrode the muted state')
      await mutedInput.focus()
      assert.equal(await mutedInput.evaluate(element=>getComputedStyle(element).color),fg,'Focused muted input did not restore host foreground')
      await mutedInput.blur()
      console.log('PASS: typed text and both autocomplete branches follow host foreground without .dark; muted state is retained')
      const inline=await snapshot()
      assert.equal(inline.prompt.backgroundColor,surface,'Ancestor surface token is ignored by prompt')
      assert.equal(inline.prompt.borderTopColor,border,'Ancestor border token is ignored by prompt')
      assert.equal(inline.promptTitle.color,fg,'Ancestor foreground token is ignored by prompt title')
      assert.equal(inline.autocomplete.backgroundColor,surface,'Ancestor surface token is ignored by autocomplete')
      assert.equal(inline.autocompleteHighlight.color,accent,'Ancestor accent token is ignored by autocomplete highlight')
      assert.equal(inline.formHelp.color,muted,'Canonical muted foreground is ignored by form help')
      assert.equal(inline.formSelect.borderTopColor,controlBorder,'Control border token is ignored by select')
      assert.equal(inline.scratchpadSelect.borderTopColor,controlBorder,'Control border token is ignored by scratchpad select')
      assert.ok(inline.prompt.boxShadow.includes(shadow),'Full host shadow is ignored by prompt')
      assert.equal(inline.autocomplete.boxShadow,shadow,'Full host shadow is ignored by plain CSS dropdown')
      await page.locator('#field-required-title').focus()
      const focused=await snapshot({input:'#field-required-title'})
      assert.equal(focused.input.borderTopColor,focus,'Focus token is ignored by input border')
      assert.ok(focused.input.boxShadow.includes(focus),'Focus token is ignored by input ring')
      await page.locator('#field-required-title').blur()
      await page.locator('#expand [data-mcp-ui-action="expand"]').hover()
      const hovered=await snapshot({button:'#expand [data-mcp-ui-action="expand"]'})
      assert.equal(hovered.button.backgroundColor,hover,'Surface hover token is ignored')
      await page.mouse.move(1200,1)
      await page.locator('#menu-trigger').evaluate(element=>element.click())
      const menuStyles=await snapshot({menu:'[data-mcp-ui-portal="menu"]'})
      assert.equal(menuStyles.menu.backgroundColor,surface,'Menu portal lost ancestor surface')
      assert.equal(menuStyles.menu.borderTopColor,border,'Menu portal lost ancestor border')
      assert.ok(menuStyles.menu.boxShadow.includes(shadow),'Menu portal lost full host shadow')
      const liveSurface='rgb(61, 43, 29)'
      await page.evaluate(value=>document.querySelector('#theme-host').style.setProperty('--mcp-ui-surface',value),liveSurface)
      const liveMenu=await snapshot({menu:'[data-mcp-ui-portal="menu"]'})
      assert.equal(liveMenu.menu.backgroundColor,liveSurface,'Open menu did not follow live ancestor token update')
      await page.evaluate(()=>{
        document.documentElement.classList.remove('dark')
        document.querySelector('#theme-host').classList.add('dark')
        document.querySelector('#theme-host').removeAttribute('style')
      })
      const removedMenu=await snapshot({menu:'[data-mcp-ui-portal="menu"]'})
      assert.equal(removedMenu.menu.backgroundColor,baseline.samples.darkMenu.menu.backgroundColor,'Source-local dark state was lost after token removal')
      assert.equal(await page.locator('[data-mcp-ui-portal="menu"]').evaluate(element=>element.style.getPropertyValue('--mcp-ui-surface')),'','Removed ancestor token remains copied on portal')
      await page.keyboard.press('Escape')
      await page.evaluate(value=>document.querySelector('#theme-host').style.setProperty('--mcp-ui-surface',value),liveSurface)
      await page.evaluate(()=>{window.__themeExpandedNode=document.querySelector('#expanded-content')})
      await page.locator('#expand [data-mcp-ui-action="expand"]').evaluate(element=>element.click())
      const dialogStyles=await snapshot({panel:'[data-mcp-ui-portal="dialog"] > div'})
      assert.equal(dialogStyles.panel.backgroundColor,liveSurface,'Dialog portal lost ancestor surface')
      await page.evaluate(()=>document.querySelector('#theme-host').classList.toggle('dark'))
      const toggledDialog=await snapshot({panel:'[data-mcp-ui-portal="dialog"] > div'})
      assert.equal(toggledDialog.panel.backgroundColor,liveSurface,'Dark toggle overrode host surface inside open dialog')
      await page.evaluate(()=>document.querySelector('#theme-host').style.removeProperty('--mcp-ui-surface'))
      const removedDialog=await snapshot({panel:'[data-mcp-ui-portal="dialog"] > div'})
      assert.equal(removedDialog.panel.backgroundColor,baseline.samples.lightDialog.panel.backgroundColor,'Open dialog did not restore light fallback after token removal')
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#expand #expanded-content').count(),1,'Expanded content was not restored exactly once')
      assert.equal(await page.evaluate(()=>window.__themeExpandedNode===document.querySelector('#expand #expanded-content')),true,'Expanding replaced the original DOM node')
      console.log('PASS: ancestor tokens, open portal live updates, dark toggle, and restored expanded content')
      const originalResetState=await page.evaluate(()=>({bodyStyle:document.body.getAttribute('style'),hostStyle:document.querySelector('#theme-host').getAttribute('style'),hostClass:document.querySelector('#theme-host').getAttribute('class')}))
      const resetSheet=await page.addStyleTag({content:'#theme-host.theme-host-reset { --mcp-ui-surface: initial; }'})
      try {
        await page.evaluate(()=>{
          document.body.style.setProperty('--mcp-ui-surface','red')
          const host=document.querySelector('#theme-host')
          host.classList.add('theme-host-reset')
          host.style.removeProperty('--mcp-ui-surface')
        })
        for(const [name,trigger,selection,expected] of [
          ['menu','#menu-trigger',{surface:'[data-mcp-ui-portal="menu"]'},baseline.samples.lightMenu.menu.backgroundColor],
          ['dialog','#expand [data-mcp-ui-action="expand"]',{surface:'[data-mcp-ui-portal="dialog"] > div'},baseline.samples.lightDialog.panel.backgroundColor],
        ]) {
          await page.locator(trigger).evaluate(element=>element.click())
          const reset=await snapshot(selection)
          assert.equal(reset.surface.backgroundColor,expected,`${name} inherited body surface despite the local initial reset`)
          const overriddenSurface='rgb(73, 91, 109)'
          await page.evaluate(value=>document.querySelector('#theme-host').style.setProperty('--mcp-ui-surface',value),overriddenSurface)
          const overridden=await snapshot(selection)
          assert.equal(overridden.surface.backgroundColor,overriddenSurface,`${name} ignored a live local override after initial reset`)
          await page.evaluate(()=>document.querySelector('#theme-host').style.removeProperty('--mcp-ui-surface'))
          const resetAgain=await snapshot(selection)
          assert.equal(resetAgain.surface.backgroundColor,expected,`${name} failed to restore local initial reset after live token removal`)
          await page.keyboard.press('Escape')
        }
        console.log('PASS: local initial resets block global body tokens in both open portals, including live override/removal')
      } finally {
        await page.keyboard.press('Escape')
        await page.evaluate(original=>{
          const host=document.querySelector('#theme-host')
          for(const [element,name,value] of [[document.body,'style',original.bodyStyle],[host,'style',original.hostStyle],[host,'class',original.hostClass]]) {
            if(value===null) element.removeAttribute(name);else element.setAttribute(name,value)
          }
        },originalResetState)
        await resetSheet.evaluate(element=>element.remove())
      }
    }
  }
} finally { await browser.close(); await server.close() }
