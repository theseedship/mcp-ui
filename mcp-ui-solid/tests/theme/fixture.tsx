import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ChatPrompt } from 'theme-source/components/ChatPrompt'
import { UIResourceRenderer } from 'theme-source/components/UIResourceRenderer'
import { ExpandableWrapper } from 'theme-source/components/ExpandableWrapper'
import { PortalDropdownMenu } from 'theme-source/components/PortalDropdownMenu'
import { ScratchpadPanel } from 'theme-source/components/ScratchpadPanel'
import { AutocompleteDropdown } from 'theme-source/components/AutocompleteDropdown'
import { FormFieldRenderer } from 'theme-source/components/FormFieldRenderer'
import './fixture.css'

function Fixture() {
  let anchor!: HTMLButtonElement
  const [menu, setMenu] = createSignal(false)
  return <main id="theme-host">
    <section id="prompt"><ChatPrompt config={{type:'choice',title:'Select format',config:{options:[{value:'csv',label:'CSV'},{value:'json',label:'JSON',description:'Structured data'}]}}} onSubmit={() => {}} /></section>
    <section id="form"><ChatPrompt config={{type:'form',title:'Required information',config:{fields:[{name:'required-title',label:'Title',type:'text',required:true,helpText:'A title is required'},{name:'report-kind',label:'Kind',type:'select',options:[{value:'brief',label:'Brief'},{value:'full',label:'Full'}]}],submitLabel:'Send form'}}} onSubmit={() => {}} /></section>
    <section id="error-field"><FormFieldRenderer field={{name:'invalid-title',label:'Invalid title',type:'text',required:true}} value="" error="Enter a title" onChange={() => {}} /></section>
    <section id="table"><UIResourceRenderer content={{id:'theme-table',type:'table',position:{colStart:1,colSpan:12},params:{title:'Values',columns:[{key:'name',label:'Name'},{key:'value',label:'Value'}],rows:[{name:'Alpha',value:12},{name:'Beta',value:null}]}}} /></section>
    <section id="expand"><ExpandableWrapper title="Expanded example" toolbarVariant="always-visible"><p id="expanded-content">Persistent content</p></ExpandableWrapper></section>
    <section id="scratchpad"><ScratchpadPanel state={{id:'theme-pad',title:'Workspace',status:'ready',filters:{},agentMessages:[{text:'Available',type:'info'}],sections:[{id:'filter-section',title:'Filters',type:'filter',editable:true,source:'agent',content:{category:{label:'Category filter',options:[{value:'brief',label:'Brief filter'},{value:'full',label:'Full filter'}]}}},{id:'form-section',title:'Details',type:'form',editable:true,source:'agent',content:{fields:[{name:'pad-kind',label:'Scratchpad kind',type:'select',required:true,options:[{value:'brief',label:'Brief'},{value:'full',label:'Full'}]}]}}]}} /></section>
    <button id="menu-trigger" ref={anchor} onClick={() => setMenu(!menu())}>Toggle menu</button>
    <PortalDropdownMenu open={menu()} onClose={() => setMenu(false)} trigger={anchor}><button id="menu-item">Menu item</button></PortalDropdownMenu>
    <section id="autocomplete" style={{position:'relative',height:'200px'}}><AutocompleteDropdown isOpen options={[{value:'a',label:'Alpha',description:'First'},{value:'b',label:'Beta'}]} selectedIndex={0} onSelect={() => {}} highlightMatch="Al" /></section>
  </main>
}
render(() => <Fixture />, document.getElementById('app')!)
