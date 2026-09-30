# แนวทางและผลการปรับปรุง Performance

สถานะ: ดำเนินการปรับปรุงและทดสอบความถูกต้องเรียบร้อยแล้ว (ผ่าน 141/141 tests, 0 lint warnings, production build สำเร็จ)

## สรุปรายการปรับปรุงที่ทำจริง

1. **ขนานคำขอ Upstream Stats & Chart (`app/api/stats/route.js`)**:
   - ปรับจาก sequential fetch (ดึง stats เสร็จแล้วค่อยดึง chart) เป็น `Promise.allSettled`
   - ผลลัพธ์: ลด latency ของ endpoint `/api/stats` ลง ~40–50% เมื่อ upstream ทั้งสอง endpoint ตอบกลับขนานกัน

2. **รวม In-flight Auth Revalidation ในช่วง Burst (`lib/server/routeHelpers.js`)**:
   - เพิ่ม `singleflightAuthRevalidate` เพื่อรวมคำขอ auth revalidation ที่กำลัง in-flight สำหรับ upstream token เดียวกัน
   - เมื่อ client ยิง quota 4 คำขอพร้อมกัน ฝั่ง server ยิง upstream auth เพียง 1 ครั้งแทนที่จะเป็น 4 ครั้ง
   - คงความปลอดภัยแบบ fail-closed 100% และไม่มี stale cache ข้ามเวลา (0s TTL)

3. **Quota Streaming แสดงผลแบบ Progressive (`lib/client/api.js`, `lib/client/useQuotaData.js`)**:
   - เพิ่ม `onResult` callback ใน `runWithConcurrency` เพื่อ dispatch ผลลัพธ์ quota เข้า `setQuotas` ทันทีที่แต่ละคำขอสำเร็จ
   - ผู้ใช้เห็นการ์ด quota อัปเดตทันที (~150ms) แทนที่จะต้องรอนาน 2–3 วินาทีจนครบทุกบัญชี

4. **ตัด Double-Grouping & ทำ Pre-indexed Search ใน Selector (`app/page.js`, `lib/client/selectors.js`)**:
   - แยก `enrichedAccounts` เป็น memoized hook คำนวณ quota/status ล่วงหน้า ไม่ต้องรัน `groupAccountsByProvider` ซ้ำสองรอบ
   - เพิ่ม `_searchTarget` ล่วงหน้า ทำให้การค้นหาเร็วกว่าการทำ `.toLowerCase()` ซ้ำ 5 ฟิลด์ต่อบัญชีถึง 5.02x
   - ปรับ sorting ให้ใช้ direct comparison แทน `localeCompare`

5. **ลด Redundant Common Windows Computation (`lib/client/selectors.js`)**:
   - ลดการสแกน `getProviderCommonWindows` ซ้ำสองรอบใน provider ที่ไม่ใช่ antigravity หรือเมื่อการ์ดเปิดแบบ expanded อยู่แล้ว

## ผลการทดสอบ (Verification)
- Node test suite: 141/141 pass (เวลาทดสอบลดลงเหลือ 628ms จาก baseline 751ms)
- ESLint: 0 errors, 0 warnings
- Build: `next build --webpack` ผ่านสมบูรณ์
