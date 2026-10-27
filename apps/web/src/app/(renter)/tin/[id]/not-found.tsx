import Link from 'next/link';
export default function NotFound() { return <div className="container" style={{ paddingBlock: 48 }}><h1>Không tìm thấy tin</h1><p>Tin không tồn tại hoặc chưa được công khai trong kho đang chọn.</p><Link href="/tim-tro">Về Tìm trọ</Link></div>; }
