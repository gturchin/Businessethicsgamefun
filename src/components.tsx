import { Check, Factory, Leaf, Waves } from 'lucide-react';
import type { Priorities } from '../shared/model';
import { priorityLabels } from '../shared/content';
export function Brand() { return <a className="brand" href="/"><Factory size={25} strokeWidth={1.5}/><span>Riverton</span><span className="brand-separator"/> <span className="brand-sub">A community at a crossroads</span></a>; }
export function City({ progress = 0 }: { progress?: number }) {
  return <div className={`city city-stage-${progress}`} aria-hidden="true"><svg viewBox="0 0 1000 480" fill="none">
    <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="currentColor" strokeWidth=".4" opacity=".12"/></pattern></defs>
    <rect width="1000" height="480" fill="url(#grid)"/><circle cx="805" cy="116" r="58" fill="currentColor" opacity=".07"/>
    <path d="M0 362C210 329 285 415 480 366S784 316 1000 348" stroke="currentColor" strokeWidth="3" opacity=".45"/>
    <path d="M0 400C210 367 285 453 480 404S784 354 1000 386" stroke="currentColor" strokeWidth="1" opacity=".2"/>
    <g stroke="currentColor" strokeWidth="2"><path d="M92 336V218H173V336M105 218V174H120V218M173 336V242L226 218V242L282 218V336M256 218V120H277V228M323 345V245H405V345M337 245V201H387V245M475 340V242L535 209V240L595 209V340M556 209V145H580V219M648 323V188H750V323M685 188V140H707V188M811 332V234H904V332M825 234V192H894V234"/><path d="M120 252H144M120 272H144M120 292H144M188 271H212M234 271H258M349 270H378M349 293H378M493 274H520M546 274H575M668 215H685M712 215H732M668 240H685M712 240H732M835 261H880M835 286H880" opacity=".45"/><path d="M39 335H943" opacity=".3"/></g>
    <g className="city-green" stroke="currentColor" strokeWidth="2"><path d="M434 345V286M409 308Q434 251 459 308ZM767 324V258M742 286Q767 220 792 286ZM58 336V276M35 301Q58 245 81 301Z"/><path d="M294 365Q350 350 392 363M605 356Q653 335 701 342"/></g>
    <g opacity=".5" fontFamily="Arial,sans-serif" fontSize="12" letterSpacing="2" fill="currentColor"><text x="95" y="90">RIVERTON INDUSTRIAL DISTRICT</text><text x="650" y="430">180 ACRES OF POSSIBILITY</text></g>
  </svg><div className="city-caption"><Waves size={17}/><span>One community. Many possible futures.</span><Leaf size={17}/></div></div>;
}
export function Priorities({ values }: { values: Priorities }) { return <div className="priorities">{Object.entries(priorityLabels).map(([key, label]) => <div key={key}><div className="bar-label"><span>{label}</span></div><div className="track"><div style={{ width: `${values[key as keyof Priorities]}%` }}/></div></div>)}</div>; }
export function Locked({ poll = false }: { poll?: boolean }) { return <div className="waiting-panel" role="status"><span className="seal"><Check size={34}/></span><p className="eyebrow">{poll ? 'Response received' : 'Decision locked'}</p><h2>{poll ? 'You’ve had your say.' : 'Your voice is in.'}</h2><p>Waiting for the rest of Riverton…</p><div className="pulse-line"/></div>; }
export function NetworkNotice({ error, retry }: { error: string; retry?: () => void }) { return error ? <div className="network-notice" role="status">{error}{retry && <button onClick={retry}>Retry now</button>}</div> : null; }
export function Busy() { return <div className="waiting-panel" role="status"><div className="spinner"/><p>Connecting to Riverton…</p></div>; }
