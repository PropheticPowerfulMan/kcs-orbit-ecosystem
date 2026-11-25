import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {publicBase} from './security.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export function juryPdf(title: string, subtitle: string, period: string, reference: string, language: 'en'|'fr' = 'en') {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 111, bottom: 108, left: 44, right: 44 }, bufferPages: true, info: { Title: title, Author: 'Kinshasa Christian School', Creator: 'KCS Nexus Jury · KCS Orbit Ecosystem' } });
    doc.registerFont('KCSRegular',resolve('assets/jury/LiberationSans-Regular.ttf'));
    doc.registerFont('KCSBold',resolve('assets/jury/LiberationSans-Bold.ttf'));
    doc.font('KCSRegular');
    const chunks: Buffer[] = [], done = new Promise<Buffer>((resolve, reject) => { doc.on('data', b => chunks.push(b)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); }), logo = resolve(process.env.JURY_LOGO_PATH || 'assets/jury/kcs-emblem.jpg'), navy = '#182D42', teal = '#287F82', gold = '#BE9958', ink = '#263E50', muted = '#627581', width = 507;
    function header() { doc.save(); doc.rect(0, 0, 595, 7).fill(gold); doc.roundedRect(32, 23, 531, 68, 12).fill(navy); if (existsSync(logo))
        doc.image(logo, 46, 33, { fit: [48, 48] }); doc.fillColor('#FFFFFF').font('KCSBold').fontSize(13).text('KINSHASA CHRISTIAN SCHOOL', 106, 37, { width: 430 }); doc.font('KCSRegular').fontSize(9).fillColor('#D6E6E8').text('KCS NEXUS JURY  /  EVALUATE FAIRLY. EMPOWER EXCELLENCE.', 106, 58, { width: 430 }); if (existsSync(logo)) {
        doc.opacity(0.035).image(logo, 173, 290, { fit: [250, 250] });
        doc.opacity(1);
    } doc.restore(); doc.y = 111; doc.x = 44; }
    doc.on('pageAdded', header);
    header();
    doc.font('KCSBold').fontSize(23).fillColor(navy).text(title, { width });
    doc.moveDown(0.6);
    doc.font('KCSRegular').fontSize(11).fillColor(ink).text(subtitle, { width });
    doc.fontSize(9).fillColor(muted).text(period);
    doc.moveDown();
    function ensure(h: number) { if (doc.y + h > 722)
        doc.addPage(); }
    function section(title: string) { ensure(65); doc.moveDown(0.7); const y = doc.y; doc.rect(44, y, 4, 17).fill(gold); doc.font('KCSBold').fontSize(12).fillColor(navy).text(title, 55, y + 1, { width: 495 }); doc.y = y + 27; doc.x = 44; }
    function text(value: string) { doc.font('KCSRegular').fontSize(9).fillColor(ink).text(value || '—', 44, doc.y, { width, lineGap: 4 }); doc.moveDown(0.5); }
    function table(headers: string[], rows: any[][], ratios: number[]) {
        const widths = ratios.map(v => v * width);
        let index = 0;
        function row(values: any[], head = false) { const heights = values.map((v, i) => doc.font(head ? 'KCSBold' : 'KCSRegular').fontSize(head ? 8 : 8.5).heightOfString(String(v ?? '—'), { width: widths[i] - 16, lineGap: 2 })), h = Math.max(25, ...heights.map(v => v + 14)); if (h > 600)
            throw new Error('REPORT_ROW_TOO_LONG'); if (doc.y + h > 722) {
            doc.addPage();
            if (!head)
                row(headers, true);
        } const y = doc.y; let x = 44; doc.rect(x, y, width, h).fill(head ? navy : index % 2 ? '#F0F5F3' : '#FAFBF8'); values.forEach((v, i) => { doc.font(head ? 'KCSBold' : 'KCSRegular').fontSize(head ? 8 : 8.5).fillColor(head ? '#FFFFFF' : ink).text(String(v ?? '—'), x + 8, y + 7, { width: widths[i] - 16, lineGap: 2 }); x += widths[i]; }); doc.y = y + h; doc.x = 44; index++; }
        row(headers, true);
        rows.forEach(values => row(values));
    }
    function distribution(values: number[], title: string) { if (!values.length)
        return; section(title); const mean = values.reduce((a, b) => a + b, 0) / values.length, sorted = [...values].sort((a, b) => a - b), median = values.length % 2 ? sorted[Math.floor(values.length / 2)] : (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2, sd = Math.sqrt(values.reduce((n, v) => n + (v - mean) ** 2, 0) / values.length); text(`n = ${values.length}   ·   ${language==='fr'?'Moyenne':'Mean'} ${mean.toFixed(2)}%   ·   ${language==='fr'?'Médiane':'Median'} ${median.toFixed(2)}%   ·   σ ${sd.toFixed(2)}`); ensure(125); const y = doc.y, bins = [0, 20, 40, 60, 80].map((low, i) => values.filter(v => v >= low && (i === 4 ? v <= 100 : v < low + 20)).length), maximum = Math.max(1, ...bins); bins.forEach((count, i) => { const h = 80 * count / maximum, x = 55 + i * 98; doc.roundedRect(x, y + 85 - h, 65, Math.max(1, h), 4).fill(i >= 3 ? teal : navy); doc.fontSize(8).fillColor(ink).text(String(count), x, y + 72 - h, { width: 65, align: 'center' }).text(`${i * 20}–${i * 20 + 20}%`, x, y + 93, { width: 65, align: 'center' }); }); doc.y = y + 120; doc.x = 44; }
    async function finish() {
        const range=doc.bufferedPageRange(),isCertificate=!reference.startsWith('KCS-JURY-RPT-'),payload=isCertificate?publicBase()+'#/verify?reference='+encodeURIComponent(reference):JSON.stringify({issuer:'KCS Nexus Jury',type:'REPORT_REFERENCE',reference}),qr=QRCode.create(payload,{errorCorrectionLevel:'M'}),size=62,cell=size/(qr.modules.size+8);
        for(let i=0;i<range.count;i++){
            doc.switchToPage(i);doc.save();const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.moveTo(44,744).lineTo(551,744).lineWidth(1).strokeColor(gold).stroke();
            doc.rect(485,753,size,size).fill('#FFFFFF');for(let row=0;row<qr.modules.size;row++)for(let col=0;col<qr.modules.size;col++)if(qr.modules.data[row*qr.modules.size+col])doc.rect(485+(col+4)*cell,753+(row+4)*cell,cell+.01,cell+.01).fill(ink);
            doc.font('KCSBold').fontSize(8).fillColor(navy).text('KINSHASA CHRISTIAN SCHOOL · KCS ORBIT ECOSYSTEM',44,755,{width:430,lineBreak:false});
            doc.font('KCSRegular').fontSize(7).fillColor(muted).text('Macampagne, Ngaliema · Kinshasa, DRC · +243 895 326 011',44,770,{width:425,lineBreak:false}).text('kinshasachristianschool@gmail.com · www.kinshasachristianschool.org',44,783,{width:425,lineBreak:false}).text(reference,44,797,{width:425,lineBreak:false}).text(isCertificate?(language==='fr'?'QR : vérification du certificat':'QR: certificate verification'):(language==='fr'?'QR : référence du document, sans données personnelles':'QR: document reference, without personal data'),44,810,{width:425,lineBreak:false});
            doc.fontSize(7).text(`${i+1} / ${range.count}`,510,822,{width:41,align:'right',lineBreak:false});doc.page.margins.bottom=bottom;doc.restore();
        }if(doc.bufferedPageRange().count!==range.count)throw new Error('REPORT_FOOTER_PAGINATION_CHANGED');doc.end();return{bytes:await done,pages:range.count};
    }
    return { doc, section, text, table, distribution, ensure, finish, colors: { navy, teal, gold, ink, muted } };
}
