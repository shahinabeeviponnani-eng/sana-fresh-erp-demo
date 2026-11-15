const BASE = 'http://localhost:3000';
const lr = await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@sanafresh.co.uk',password:'admin123'})});
const cookie = lr.headers.get('set-cookie').split(';')[0];
console.log('Login:', lr.status, 'cookie:', cookie.slice(0,30));

const s1 = await fetch(BASE+'/api/stock',{headers:{Cookie:cookie}});
console.log('Stock status:', s1.status);
const st = await s1.text();
console.log('Stock body (first 200):', st.slice(0,200));

const r1 = await fetch(BASE+'/api/returns/sales',{headers:{Cookie:cookie}});
console.log('Returns/sales status:', r1.status);
const rt = await r1.text();
console.log('Returns/sales body (first 200):', rt.slice(0,200));

const l1 = await fetch(BASE+'/api/ledger/customer/1',{headers:{Cookie:cookie}});
console.log('Ledger/customer/1 status:', l1.status);
const lt = await l1.text();
console.log('Ledger body (first 200):', lt.slice(0,200));
