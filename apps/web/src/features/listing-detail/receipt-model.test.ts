import test from 'node:test';
import assert from 'node:assert/strict';
import type { Evidence, Listing } from '@/lib/api/types';
import { comparisonReady, groundedEvidence, publicSource, receiptModel } from './receipt-model';

test('evidence uses code points and rejects mismatched, negative and empty spans',()=>{
  const valid={start:2,end:10,quote:'Cầu Giấy',label:'LOC'} as Evidence;
  assert.deepEqual(groundedEvidence('🏠 Cầu Giấy',[valid,{...valid,start:3},{...valid,start:-1},{...valid,end:2}]),[valid]);
});
test('receipt preserves missing fields, distinct fees, unknown periods and fractional deposit',()=>{
  const text='🏠 #12tr5; phí khác 45k; cọc 1,5 tháng';
  const ev=(quote:string,label:Evidence['label']):Evidence=>{const start=Array.from(text.slice(0,text.indexOf(quote))).length;return {start,end:start+Array.from(quote).length,quote,label,method:'regex'}};
  const listing={rent:{visibility:'disclosed',amount_form:'exact',amount_vnd:12500000,basis:'per_unit',period:'month',includes:[],evidence:[ev('#12tr5','PRICE')]},area:{value_m2:null,amount_form:'none',evidence:[]},room:{property_type:'unknown',furnishing:'unknown',evidence:[]},location:{evidence:[]},fees:[{type:'other',unit:'unknown',amount_vnd:45000,evidence:[ev('phí khác 45k','FEE')]},{type:'deposit',unit:'months_of_rent',months:1.5,evidence:[ev('cọc 1,5 tháng','FEE')]}]} as unknown as Listing;
  const m=receiptModel(listing,text);
  assert.equal(m.price,'12.500.000 đ');assert.equal(m.suffix,'/tháng');
  assert(m.rows.filter(r=>r.section==='fact').every(r=>r.value==='Không đề cập'));
  assert.equal(m.rows.find(r=>r.section==='fee')?.value,'45.000 đ · chưa rõ kỳ');
  assert.equal(m.rows.find(r=>r.section==='deposit')?.value,'1,5 tháng tiền thuê');
  assert.equal(receiptModel({...listing,rent:{...listing.rent,evidence:[]}},text).price,'Không đề cập');
});
test('mean requires API eligibility and never falls back to research statistics',()=>{
  assert(comparisonReady({status:'ok',n:10,mean_vnd:5000000}));
  assert(!comparisonReady({status:'ok',n:9,mean_vnd:5000000}));
  assert(!comparisonReady({status:'insufficient_data',n:10,mean_vnd:5000000}));
  assert(!comparisonReady({status:'ok',n:10,mean_vnd:null}));
  assert(!comparisonReady({status:'ok',n:10,mean_vnd:NaN}));
  assert.equal(publicSource('qa-case-fee-unknown'),null);
  assert.equal(publicSource('Nhóm trọ ví dụ'),'Nhóm trọ ví dụ');
});
