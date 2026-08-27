import React from 'react';
const nexusUrl=(import.meta.env.VITE_NEXUS_URL||'http://localhost:5173').replace(/\/$/,'');
export default function LegacyImportLink({entity}){return <a href={`${nexusUrl}/admin/data-migration?entity=${encodeURIComponent(entity)}`} className="inline-flex items-center rounded-xl border border-kcs-blue/50 bg-kcs-blue/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-kcs-blue/20">Importer {entity.toLowerCase()} via Data Migration</a>}
