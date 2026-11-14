export type SiteField={kind:'text'|'image'|'background'|'link';original:string;value:string}
export type SiteFields=Record<string,SiteField>
export const sitePage=(path:string)=>path==='/'?'home':path.replace(/^\//,'').split('/')[0]
export const siteRoutes=['home','about','academics','admissions','news','gallery','contact','school-handbook','shared']
export const textHash=(value:string)=>{let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
export const safeSiteUrl=(url:string,image=false)=>!/[\u0000-\u001f]/.test(url)&&(image?/^(https:\/\/|\/(?!\/))/i:/^(https:\/\/|\/(?!\/)|mailto:|tel:|#)/i).test(url)
export function elementPath(element:Element,scope:Element){let node:Element|null=element;const parts=[];while(node&&node!==scope){const parent:Element|null=node.parentElement;if(!parent)break;const siblings=Array.from(parent.children).filter(child=>child.tagName===node!.tagName);parts.unshift(node.tagName.toLowerCase()+':'+siblings.indexOf(node));node=parent}return parts.join('.')}
