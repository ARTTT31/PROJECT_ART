import Link from 'next/link'

export const metadata = {
  title: 'ข้อตกลงการใช้งาน — ART Workspace',
}

/**
 * Terms of use. Public page: it is linked from the sign-up consent checkbox
 * and must stay reachable without an account.
 *
 * The operator-specific blanks (contact address, governing entity) are marked
 * so the deployment owner fills them in — a generic placeholder would look
 * complete while being unenforceable.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6e6e73]">
        ART Workspace
      </p>
      <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#1d1d1f]">
        ข้อตกลงการใช้งาน
      </h1>
      <p className="mt-2 text-[13px] text-[#6e6e73]">ปรับปรุงล่าสุด: ตุลาคม 2026</p>

      <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed text-[#1d1d1f]">
        <section>
          <h2 className="text-[17px] font-bold">1. การยอมรับข้อตกลง</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            การสมัครหรือใช้งาน ART Workspace ถือว่าคุณยอมรับข้อตกลงฉบับนี้และ
            <Link href="/privacy" className="text-[#0066cc] underline">
              นโยบายความเป็นส่วนตัว
            </Link>{' '}
            หากไม่ยอมรับ กรุณาหยุดใช้งานและติดต่อผู้ดูแลระบบเพื่อปิดบัญชี
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">2. บัญชีผู้ใช้</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            คุณต้องให้ข้อมูลที่ถูกต้องและเป็นความจริง รักษารหัสผ่านเป็นความลับ
            และแจ้งผู้ดูแลระบบทันทีหากสงสัยว่าบัญชีถูกใช้งานโดยไม่ได้รับอนุญาต
            บัญชีอาจถูกอนุมัติ ปฏิเสธ ระงับ หรือลบได้ตามดุลพินิจของผู้ดูแลระบบ
            เพื่อความปลอดภัยหรือการปฏิบัติตามกฎหมาย
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">3. การใช้งานที่ยอมรับได้</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[#3a3a3c]">
            <li>ห้ามใช้ระบบเพื่อกระทำการผิดกฎหมาย หรือละเมิดสิทธิของผู้อื่น</li>
            <li>ห้ามพยายามเข้าถึงข้อมูลหรือระบบที่ไม่ได้รับอนุญาต</li>
            <li>ห้ามรบกวนการทำงานของระบบ เช่น การยิงคำขอถี่เกินควร หรือการส่งข้อมูลอันเป็นเท็จ</li>
            <li>ห้ามใช้ระบบกล้อง/สตรีมเพื่อบันทึกหรือเปิดเผยภาพผู้อื่นโดยไม่ได้รับความยินยอม</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">4. เนื้อหาและข้อมูลของคุณ</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ข้อมูลที่คุณสร้างในระบบ (เช่น ชื่อที่แสดง ควิกลิ้งค์ การตั้งค่าแดชบอร์ด)
            เป็นของคุณ คุณอนุญาตให้ระบบจัดเก็บและประมวลผลเพื่อให้บริการตามวัตถุประสงค์ที่ระบุไว้ใน
            นโยบายความเป็นส่วนตัว
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">5. บริการจากบุคคลที่สาม</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ระบบอาจแสดงข้อมูลจากแหล่งภายนอก เช่น พยากรณ์อากาศ ราคาน้ำมัน หรือปฏิทินวันหยุด
            และอาจใช้บริการโครงสร้างพื้นฐานจากผู้ให้บริการภายนอก ข้อมูลดังกล่าวอาจคลาดเคลื่อน
            หรือหยุดให้บริการได้โดยไม่แจ้งล่วงหน้า ระบบไม่รับประกันความถูกต้องของข้อมูลเหล่านั้น
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">6. การระงับหรือยกเลิก</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            คุณสามารถลบบัญชีของตนเองได้ที่หน้าโปรไฟล์ ระบบจะเก็บบัญชีไว้ในถังขยะตามระยะเวลา
            ที่กำหนดเพื่อให้ผู้ดูแลระบบกู้คืนได้ หากต้องการให้ลบถาวรทันที กรุณาติดต่อผู้ดูแลระบบ
            ผู้ดูแลระบบอาจระงับหรือลบบัญชีที่ละเมิดข้อตกลงฉบับนี้
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">7. ข้อจำกัดความรับผิด</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ระบบให้บริการ “ตามสภาพที่เป็นอยู่” ภายในขอบเขตที่กฎหมายอนุญาต
            ผู้ให้บริการไม่รับผิดชอบต่อความเสียหายทางอ้อมหรือความเสียหายที่เกิดจากการใช้
            หรือไม่สามารถใช้ระบบได้
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">8. กฎหมายที่ใช้บังคับ</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ข้อตกลงนี้อยู่ภายใต้กฎหมายแห่งราชอาณาจักรไทย รวมถึงพระราชบัญญัติว่าด้วยการกระทำ
            ความผิดเกี่ยวกับคอมพิวเตอร์ และพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">9. การเปลี่ยนแปลงข้อตกลง</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ข้อตกลงอาจได้รับการปรับปรุงเป็นครั้งคราว เมื่อมีการเปลี่ยนแปลงสาระสำคัญ
            ระบบจะแจ้งให้ทราบผ่านหน้าจอหรืออีเมล และการใช้งานต่อถือเป็นการยอมรับฉบับใหม่
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold">10. ติดต่อ</h2>
          <p className="mt-1.5 text-[#3a3a3c]">
            ผู้ดูแลระบบ: <span className="font-semibold">[กรอกอีเมลผู้ดูแลระบบ]</span>
            <br />
            ที่อยู่ผู้ควบคุมข้อมูล: <span className="font-semibold">[กรอกที่อยู่/หน่วยงาน]</span>
          </p>
        </section>
      </div>

      <p className="mt-10 text-[13px]">
        <Link href="/login" className="text-[#0066cc] underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </main>
  )
}
