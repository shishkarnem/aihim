import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Mail, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Oferta: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto pb-12"
    >
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-gold flex items-center gap-2 text-xs font-mono uppercase hover:underline">
          <ArrowLeft size={16} /> На главную
        </Link>
        <span className="text-[10px] text-sepia/40 font-mono">Договор-оферта</span>
      </div>

      <div className="parchment-card p-6 md:p-10 border-2 border-gold/40 shadow-[0_0_30px_rgba(201,163,67,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full filter blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 mb-8 border-b border-sepia/10 pb-6">
          <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center border border-gold/30">
            <FileText size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="font-gothic text-2xl md:text-3xl text-gold tracking-wider">ПУБЛИЧНАЯ ОФЕРТА</h1>
            <p className="text-xs text-sepia/60 font-mono mt-1">ДОГОВОР НА ОКАЗАНИЕ ИГРОВЫХ И ИНФОРМАЦИОННЫХ УСЛУГ</p>
          </div>
        </div>

        <div className="prose prose-sepia max-w-none text-sepia/90 text-sm leading-relaxed space-y-6">
          <div>
            <p className="font-serif italic text-sepia/70">
              Настоящий документ представляет собой официальное предложение Общества с ограниченной ответственностью «РентРоп» (далее — «Исполнитель») заключить Договор об оказании платных услуг (покупка игровой валюты / энергии «AiHim») на изложенных ниже условиях.
            </p>
          </div>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">1. Термины и определения</h3>
            <ul className="list-disc pl-5 space-y-2 font-serif text-sm">
              <li><strong>Оферта</strong> — настоящий документ «Публичная оферта», опубликованный в сети Интернет по адресу <span className="font-mono text-gold">/oferta</span>.</li>
              <li><strong>Исполнитель</strong> — Общество с ограниченной ответственностью «РентРоп» (ООО «РентРоп»), оказывающее услуги по настоящему Договору.</li>
              <li><strong>Пользователь</strong> — любое физическое лицо, осуществившее акцепт настоящей Оферты.</li>
              <li><strong>Игровая валюта (AiHim)</strong> — виртуальная внутриигровая энергия, используемая исключительно в рамках игрового приложения «AIhim Universe» для совершения виртуальных трансмутаций и разблокирования элементов. Не является платежным средством или реальной валютой.</li>
              <li><strong>Акцепт оферты</strong> — полное и безоговорочное принятие условий Оферты путем внесения оплаты за выбранное количество AiHim в приложении.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">2. Предмет договора</h3>
            <p className="font-serif">
              2.1. Исполнитель обязуется предоставить Пользователю доступ к внутриигровым сервисам, а именно начислить виртуальную игровую энергию «AiHim» на баланс Пользователя в соответствии с выбранным пакетом услуг, а Пользователь обязуется оплатить данные услуги.
            </p>
            <p className="font-serif">
              2.2. Начисление виртуальной энергии осуществляется автоматически в момент подтверждения успешной оплаты через платежный шлюз.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">3. Порядок расчетов и оказания услуг</h3>
            <p className="font-serif">
              3.1. Стоимость пакетов услуг указана в интерфейсе приложения в разделе «Магазин Энергии». Оплата производится в рублях РФ.
            </p>
            <p className="font-serif">
              3.2. Допускается ручной ввод суммы пополнения. Минимальная сумма пополнения при ручном вводе составляет <strong>100 рублей</strong> РФ.
            </p>
            <p className="font-serif">
              3.3. При совершении платежа Пользователь перенаправляется на защищенную страницу авторизованной платежной системы (например, Робокасса).
            </p>
            <p className="font-serif">
              3.4. Услуга считается оказанной в полном объеме с момента зачисления соответствующего количества виртуальной энергии «AiHim» на игровой баланс Пользователя.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">4. Права и обязанности сторон</h3>
            <p className="font-serif"><strong>4.1. Исполнитель обязуется:</strong></p>
            <ul className="list-disc pl-5 space-y-1 font-serif text-sm">
              <li>Обеспечить круглосуточную работоспособность игрового сервиса, за исключением времени проведения технических работ.</li>
              <li>Своевременно начислять оплаченную игровую энергию на баланс Пользователя.</li>
            </ul>
            <p className="font-serif"><strong>4.2. Пользователь обязуется:</strong></p>
            <ul className="list-disc pl-5 space-y-1 font-serif text-sm">
              <li>Соблюдать правила игры и не совершать мошеннических действий с платежными системами.</li>
              <li>Предоставлять достоверные данные при совершении оплаты.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">5. Отказ от ответственности и невозможность возврата средств</h3>
            <p className="font-serif">
              5.1. <strong>ВНИМАНИЕ: Возврат денежных средств за приобретенную виртуальную энергию «AiHim» невозможен ни при каких обстоятельствах.</strong> В соответствии с законодательством РФ, совершая оплату (акцепт оферты), Пользователь соглашается с тем, что услуга по предоставлению доступа к игровым возможностям и начислению энергии «AiHim» оказывается в полном объёме непосредственно в момент её начисления.
            </p>
            <p className="font-serif">
              5.2. С момента успешного зачисления «AiHim» на игровой баланс Пользователя, услуга считается полностью и качественно оказанной. Любые требования о возврате уплаченных средств (включая неиспользованные «AiHim») отклоняются в полном объёме, и возврат денежных средств не производится ни при каких условиях.
            </p>
            <p className="font-serif">
              5.3. Игровой баланс «AiHim» является исключительно виртуальным показателем, не имеет наличного или безналичного денежного эквивалента, не подлежит обналичиванию, обратному обмену на рубли, компенсации, возврату или передаче третьим лицам.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">6. Персональные данные</h3>
            <p className="font-serif">
              6.1. Исполнитель обрабатывает персональные данные Пользователя в целях исполнения настоящего Договора в соответствии с Федеральным законом РФ № 152-ФЗ «О персональных данных». Конфиденциальность гарантируется.
            </p>
          </section>

          <section className="space-y-3 border-t border-sepia/10 pt-6">
            <h3 className="font-gothic text-lg text-gold tracking-widest uppercase">7. Реквизиты Исполнителя</h3>
            <div className="bg-sepia/5 p-4 rounded border border-sepia/10 font-mono text-xs space-y-2 text-sepia/80">
              <p className="font-bold text-sepia text-sm">ООО «РентРоп»</p>
              <p><span className="text-gold">Юридический адрес:</span> г . Москва, пер. Духовской, д. 17, стр. 15, помещ. 11Н/2</p>
              <p><span className="text-gold">ОГРН:</span> 1217700234157</p>
              <p><span className="text-gold">ИНН:</span> 7726477438</p>
              <p className="flex items-center gap-1.5 mt-2">
                <Mail size={12} className="text-gold" />
                <span className="text-gold">Email для связи:</span> <a href="mailto:info@arenda-ropa.com" className="hover:underline text-sepia font-bold">info@arenda-ropa.com</a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-10 flex items-center gap-2 justify-center text-[10px] text-sepia/40 uppercase tracking-widest font-mono border-t border-sepia/10 pt-6">
          <ShieldCheck size={14} className="text-gold" />
          Все права защищены © 2026 ООО «РентРоп»
        </div>
      </div>
    </motion.div>
  );
};
