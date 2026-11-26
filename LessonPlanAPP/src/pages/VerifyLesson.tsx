import {useEffect,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {useApp} from '../contexts/AppContext';
import {verifyLessonDocument} from '../services/lessonDocumentService';
import {LessonPrint} from '../print/LessonPrint';
export const VerifyLesson=()=>{
 const {currentUser,loading}=useAuth(),{language}=useApp(),{id}=useParams(),[params]=useSearchParams(),hash=params.get('hash')||'';
 const tr=(en:string,fr:string)=>language==='fr'?fr:en;
 const [result,setResult]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{if(!currentUser||!id)return;let cancelled=false;setError('');setResult(null);void verifyLessonDocument(id,hash).then(data=>{if(!cancelled)setResult(data)}).catch(reason=>{if(!cancelled)setError(reason.message)});return()=>{cancelled=true}},[id,hash,currentUser?.id]);
 const target='/verify/'+encodeURIComponent(id||'')+'?hash='+encodeURIComponent(hash);
 return <main className="ep-dialog mx-auto max-w-6xl min-h-screen p-5 sm:p-9"><h1 className="text-2xl font-bold">{tr('KCS · Lesson document verification','KCS · Vérification du plan de leçon')}</h1>
  <p className="my-3">{tr('This QR refers to the complete saved plan. School access is required to protect teaching records.','Ce QR renvoie au plan complet enregistré. Un accès scolaire est requis pour protéger les dossiers pédagogiques.')}</p>
  {loading?<p role="status">{tr('Verifying your session…','Vérification de votre session…')}</p>:!currentUser?<Link className="ep-document-link" to={'/login?returnTo='+encodeURIComponent(target)}>{tr('Sign in to verify this document','Se connecter pour vérifier ce document')}</Link>:error?<p role="alert">{error}</p>:!result?<p role="status">{tr('Reading the saved version…','Lecture de la version enregistrée…')}</p>:<><p role="status" className="my-4 p-4 border rounded-lg">{result.matched?(result.historical?tr('Matching saved revision found.','Une révision enregistrée correspond au document.'):tr('The saved plan matches this document.','Le plan enregistré correspond au document.')):tr('This plan has changed. The printed version could not be found in the saved revisions. The current plan below must not be treated as the original document.','Ce plan a changé. La version imprimée n’a pas été retrouvée dans les révisions. Le plan actuel ci-dessous ne doit pas être considéré comme le document original.')}</p><p className="text-xs break-all mb-4">SHA-256: {hash}</p><LessonPrint lesson={result.lesson}/></>}
  <Link className="ep-document-link mt-5" to="/">{tr('Back to Eduplanner','Retour à Eduplanner')}</Link>
 </main>
};
