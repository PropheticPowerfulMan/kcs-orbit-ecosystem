import {financeAlertText} from '../utils/financeAlertText';
export function FinanceAlertMessage({message,lang}:{message:string;lang:string}) {
 const {body,reference}=financeAlertText(message);
 return <div className="ep-alert-message"><p>{body}</p>{reference&&<details className="ep-alert-reference"><summary>{lang==='fr'?'Référence technique':'Technical reference'}</summary><code>{reference}</code></details>}</div>;
}
