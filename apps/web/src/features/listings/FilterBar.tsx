'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { PROPERTY_LABEL } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { FILTER_TYPES } from './filters';
import styles from './FilterBar.module.css';

export function FilterBar({ wards, demo }: { wards:string[]; demo?:boolean }) {
  const router=useRouter(); const pathname=usePathname(); const params=useSearchParams();
  const [pending,startTransition]=useTransition(); const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null); const trigger=useRef<HTMLButtonElement>(null);
  const activeCount=params.getAll('phuong').length+params.getAll('loai').length+['gia_min','gia_max','dt_min','dt_max','co_gia'].filter(k=>params.get(k)).length;
  const close=()=>dialog.current?.close();
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const wide=matchMedia('(min-width: 901px)');const resize=()=>{if(wide.matches)dialog.current?.close()};wide.addEventListener('change',resize);
    return()=>{document.body.style.overflow=previous;wide.removeEventListener('change',resize)};
  },[open]);
  const navigate=(next:URLSearchParams)=>{
    next.delete('trang');next.delete('nguon');
    if(demo!==undefined)next.set('demo',String(demo));
    startTransition(()=>router.replace(`${pathname}${next.size?'?'+next:''}`,{scroll:false}));
    close();
  };
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const data=new FormData(event.currentTarget);const next=new URLSearchParams();
    for(const [key,value] of data)if(typeof value==='string'&&value.trim())next.append(key,value.trim());
    if(params.has('demo'))next.set('demo',params.get('demo')!);
    navigate(next);
  };
  const clear=()=>{const next=new URLSearchParams();if(params.has('demo'))next.set('demo',params.get('demo')!);navigate(next)};
  const trapFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{
    if(event.key!=='Tab')return;
    const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  };
  const fields=(mobile:boolean)=><FilterForm key={`${mobile}-${params}`} wards={wards} params={params} pending={pending} mobile={mobile} submit={submit} clear={clear} close={close} />;
  return <aside className={styles.bar} aria-label="Bộ lọc tin" aria-busy={pending}>
    <div className={styles.desktop}>{fields(false)}</div>
    <button ref={trigger} className={styles.mobileToggle} type="button" aria-expanded={open} aria-controls="listing-filter-dialog" onClick={()=>{dialog.current?.showModal();setOpen(true)}}><SlidersHorizontal size={17} aria-hidden="true" />Bộ lọc{activeCount?` · ${activeCount}`:''}</button>
    <dialog ref={dialog} id="listing-filter-dialog" className={styles.drawer} aria-labelledby="mobile-filter-title" onKeyDown={trapFocus} onClose={()=>{setOpen(false);trigger.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}}>{fields(true)}</dialog>
    <p className={styles.pending} role="status">{pending?'Đang cập nhật danh sách…':''}</p>
  </aside>;
}
function FilterForm({wards,params,pending,mobile,submit,clear,close}:{wards:string[];params:ReturnType<typeof useSearchParams>;pending:boolean;mobile:boolean;submit:(e:FormEvent<HTMLFormElement>)=>void;clear:()=>void;close:()=>void}) {
  const prefix=mobile?'mobile':'desktop';
  return <form onSubmit={submit} className={styles.form}>
    <header className={styles.head}><h2 id={mobile?'mobile-filter-title':undefined}>Lọc tin</h2>{mobile&&<button type="button" className={styles.close} onClick={close} aria-label="Đóng bộ lọc" autoFocus><X size={20} aria-hidden="true" /></button>}</header>
    <div className={styles.fields}>
    <fieldset className={styles.group}><legend>Phường</legend>{wards.length?wards.map(ward=><label className={styles.check} key={ward}><input type="checkbox" name="phuong" value={ward} defaultChecked={params.getAll('phuong').includes(ward)} /><span><AtomicText text={ward} /></span></label>):<p className={styles.help}>Chưa tải được phường hoặc kho chưa có tin.</p>}</fieldset>
    <fieldset className={styles.group}><legend>Loại phòng</legend>{FILTER_TYPES.map(type=><label className={styles.check} key={type}><input type="checkbox" name="loai" value={type} defaultChecked={params.getAll('loai').includes(type)} /><span>{PROPERTY_LABEL[type]}</span></label>)}</fieldset>
    <RangeField prefix={prefix} label="Giá thuê · triệu/tháng" minKey="gia_min" maxKey="gia_max" step="0.1" params={params} />
    <RangeField prefix={prefix} label="Diện tích · m²" minKey="dt_min" maxKey="dt_max" step="1" params={params} />
    <label className={styles.check}><input type="checkbox" name="co_gia" value="1" defaultChecked={params.get('co_gia')==='1'} /><span>Chỉ tin có giá</span></label>
    <label className={styles.sort}><span>Sắp xếp</span><select name="sap_xep" defaultValue={params.get('sap_xep')??'newest'}><option value="newest">Mới nhất</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option></select></label>
    <p className={styles.help}>Giá thuê không bao gồm phí. Bộ lọc đã áp dụng được lưu trên URL.</p>
    </div>
    <div className={styles.actions}><button className={styles.apply} type="submit" disabled={pending}>{pending?'Đang áp dụng…':'Áp dụng'}</button><button className={styles.clear} type="button" onClick={clear} disabled={pending}>Xóa lọc</button></div>
  </form>;
}
function RangeField({prefix,label,minKey,maxKey,step,params}:{prefix:string;label:string;minKey:string;maxKey:string;step:string;params:ReturnType<typeof useSearchParams>}) {
  const clean=(key:string)=>(params.get(key)??'').replace(',','.');
  return <fieldset className={styles.group}><legend>{label}</legend><div className={styles.range}>
    <label htmlFor={`${prefix}-${minKey}`}><span>Từ</span><input id={`${prefix}-${minKey}`} name={minKey} aria-label={`${label} từ`} type="number" min="0" step={step} inputMode="decimal" defaultValue={clean(minKey)} /></label>
    <label htmlFor={`${prefix}-${maxKey}`}><span>Đến</span><input id={`${prefix}-${maxKey}`} name={maxKey} aria-label={`${label} đến`} type="number" min="0" step={step} inputMode="decimal" defaultValue={clean(maxKey)} /></label>
  </div></fieldset>;
}
