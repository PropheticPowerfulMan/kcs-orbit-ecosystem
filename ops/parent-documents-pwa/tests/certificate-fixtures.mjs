import{writeFile}from'node:fs/promises';
import{officialCertificatePdf}from'./dist/utils/officialCertificatePdf.js';
import{admissionCertificatePdf}from'./dist/utils/admissionCertificatePdf.js';
const checks=[];for(const language of['fr','en'])for(const documentType of['attendance','completion','admission']){
 const base={academicYear:'2026-2027',language,includeAuthentication:true,principal:{name:'Pekita Exemple Demonstration'},headOfSchool:{name:'Direction Exemple Demonstration'}};
 const result=documentType==='admission'?await admissionCertificatePdf({...base,applicationNumber:'QA-ADMISSION-ONLY',child:{firstName:'Sample',middleName:'Élève de démonstration',lastName:'Synthetic',gradeApplying:'Grade 4',dateOfBirth:'2016-02-03'}}):await officialCertificatePdf({...base,documentType,studentId:'qa-certificate-only',studentNumber:'QA-STUDENT-ONLY',studentName:'Synthetic Élève de démonstration Sample',grade:'Grade 4',dateOfBirth:'2016-02-03',placeOfBirth:'Kinshasa'});
 await writeFile('/evidence/certificate-'+documentType+'-'+language+'.pdf',result.buffer);checks.push({documentType,language,bytes:result.buffer.length,documentId:result.documentId});
}await writeFile('/evidence/certificate-fixtures.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({generated:checks.length,syntheticOnly:true}));
