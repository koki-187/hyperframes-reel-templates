import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DeviceRegistry} from '../security/device-registry.mjs';
import {AuditLog,redactAuditValue} from '../security/audit-log.mjs';
import {MetricsStore} from '../operations/metrics-store.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'14dna-security-'));
try{
 const registry=new DeviceRegistry({directory:path.join(root,'devices'),pepper:'test-pepper',codeTtlMinutes:5});
 await registry.initialize();
 const enrollment=await registry.createEnrollmentCode({label:'iPhone'});
 assert.match(enrollment.code,/^[A-Z0-9]{8,32}$/);
 const device=await registry.registerDevice({deviceId:'iphone-14dna-0001',code:enrollment.code,label:'Primary iPhone',userAgent:'Test'});
 assert.equal(device.id,'iphone-14dna-0001');
 assert.equal((await registry.authorize(device.id)).ok,true);
 await assert.rejects(()=>registry.registerDevice({deviceId:'iphone-14dna-0002',code:enrollment.code}),/ENROLLMENT_CODE_USED/);
 const revoked=await registry.revokeDevice(device.id,{reason:'lost'});
 assert.equal(Boolean(revoked.revokedAt),true);
 assert.equal((await registry.authorize(device.id)).reason,'DEVICE_REVOKED');

 const audit=new AuditLog({file:path.join(root,'audit','events.jsonl'),pepper:'audit-pepper'});
 await audit.initialize();
 await audit.write({event:'device.register',deviceId:'iphone-14dna-0001',ip:'192.168.1.10',details:{authorization:'Bearer secret',localPath:'/Users/name/private/file.png',safe:'ok'}});
 const rows=await audit.readRecent();
 assert.equal(rows.length,1);
 assert.equal(rows[0].details.authorization,'[REDACTED]');
 assert.match(rows[0].details.localPath,/\[LOCAL_PATH\]/);
 assert.equal(rows[0].details.safe,'ok');
 assert.notEqual(rows[0].device,'iphone-14dna-0001');
 assert.equal(redactAuditValue({apiKey:'secret'}).apiKey,'[REDACTED]');

 const metrics=new MetricsStore({file:path.join(root,'metrics','metrics.json')});
 await metrics.initialize();
 await metrics.increment('jobs.created');
 await metrics.increment('jobs.created',2);
 await metrics.recordDuration('jobs.render',120);
 await metrics.recordDuration('jobs.render',80);
 const snapshot=await metrics.snapshot();
 assert.equal(snapshot.counters['jobs.created'],3);
 assert.equal(snapshot.durations['jobs.render'].averageMs,100);
 assert.equal(snapshot.durations['jobs.render'].minMs,80);
 assert.equal(snapshot.durations['jobs.render'].maxMs,120);

 console.log('14DNA-ENGINE security and operations tests passed.');
}finally{
 await fs.rm(root,{recursive:true,force:true});
}
