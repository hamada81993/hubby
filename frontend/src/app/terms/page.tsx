import type { Metadata } from 'next';
import LegalPage, { type LegalDoc } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms of Use — Hubby' };

const CONTACT = 'hello@hubbyglobal.com';

const en: LegalDoc = {
  title: 'Terms of Use',
  updated: 'Last updated: 23 November 2026',
  intro:
    'These terms apply when you use Hubby on the web or in the mobile app. By creating an account you agree to them on behalf of yourself and the organisation you register.',
  sections: [
    {
      title: 'The service',
      body: [
        'Hubby connects to the stores and systems you choose, reads their orders, products and stock, and lets you manage them from one place. Some features depend on what each store or carrier allows through its own interface, so not every feature is available for every platform.',
      ],
    },
    {
      title: 'Your account',
      body: [
        'Keep your password and your store access keys safe, and tell us promptly if you think someone else has used your account. You are responsible for what the people you invite into your organisation do in it.',
      ],
    },
    {
      title: 'Your stores and your data',
      body: [
        'You must have the right to connect each store and system you add. Your products, orders and customer details remain yours. You give Hubby permission to process them only to provide the service to you.',
        'You are responsible for the prices, stock quantities and other changes you make through Hubby, including quantities you choose to offer above your real stock.',
      ],
    },
    {
      title: 'Figures and reports',
      body: [
        'Profit, fee and forecast figures are calculated from the information available to Hubby and are there to help you run your business. They are not accounting, tax or legal advice. Check them against your own records before relying on them.',
      ],
    },
    {
      title: 'Subscriptions',
      body: [
        'Paid plans are billed in advance for each period and renew until you cancel. Prices and what each plan includes are shown on the billing page before you subscribe.',
      ],
    },
    {
      title: 'Acceptable use',
      body: [
        'Do not use Hubby to break the law or the rules of a marketplace you sell on, to access data you have no right to, or to disrupt the service for others.',
      ],
    },
    {
      title: 'Availability and liability',
      body: [
        'We work to keep Hubby available and accurate, but it depends on third-party stores, carriers and networks that we do not control, and it is provided as it is. To the extent the law allows, Hubby is not liable for indirect losses such as lost sales or lost profit, and its total liability is limited to what you paid for the service in the three months before the claim.',
      ],
    },
    {
      title: 'Ending the agreement',
      body: [
        'You can stop using Hubby and ask for your account to be deleted at any time. We may suspend an account that breaks these terms, after telling you why where we can.',
      ],
    },
    {
      title: 'Changes and contact',
      body: [
        'We may update these terms. If a change matters, we will tell you in the app or by email before it takes effect.',
        `Questions about these terms: ${CONTACT}.`,
      ],
    },
  ],
};

const ar: LegalDoc = {
  title: 'شروط الاستخدام',
  updated: 'آخر تحديث: 23 نوفمبر 2026',
  intro:
    'تسري هذه الشروط عند استخدامك هَبّي على الويب أو في تطبيق الجوال. بإنشاء حساب فإنك توافق عليها عن نفسك وعن المنشأة التي تسجلها.',
  sections: [
    {
      title: 'الخدمة',
      body: [
        'يتصل هَبّي بالمتاجر والأنظمة التي تختارها، ويقرأ طلباتها ومنتجاتها ومخزونها، ويتيح لك إدارتها من مكان واحد. تعتمد بعض المزايا على ما يسمح به كل متجر أو شركة شحن عبر واجهته، لذا لا تتوفر كل ميزة لكل منصة.',
      ],
    },
    {
      title: 'حسابك',
      body: [
        'حافظ على كلمة المرور ومفاتيح الوصول لمتاجرك، وأبلغنا فوراً إذا اعتقدت أن غيرك استخدم حسابك. أنت مسؤول عما يفعله من تدعوهم إلى منشأتك داخلها.',
      ],
    },
    {
      title: 'متاجرك وبياناتك',
      body: [
        'يجب أن تملك حق ربط كل متجر ونظام تضيفه. منتجاتك وطلباتك وبيانات عملائك تبقى ملكك، وتمنح هَبّي الإذن بمعالجتها لتقديم الخدمة لك فقط.',
        'أنت مسؤول عن الأسعار وكميات المخزون وسائر التغييرات التي تجريها عبر هَبّي، ومنها الكميات التي تختار عرضها بأكثر من مخزونك الفعلي.',
      ],
    },
    {
      title: 'الأرقام والتقارير',
      body: [
        'تُحسب أرقام الأرباح والرسوم والتوقعات من المعلومات المتاحة لهَبّي، والغرض منها مساعدتك في إدارة عملك. ليست استشارة محاسبية أو ضريبية أو قانونية. راجعها على سجلاتك قبل الاعتماد عليها.',
      ],
    },
    {
      title: 'الاشتراكات',
      body: [
        'تُفوتر الخطط المدفوعة مقدماً عن كل فترة وتتجدد حتى تلغيها. الأسعار وما تتضمنه كل خطة معروضة في صفحة الفوترة قبل الاشتراك.',
      ],
    },
    {
      title: 'الاستخدام المقبول',
      body: [
        'لا تستخدم هَبّي لمخالفة الأنظمة أو قواعد منصة تبيع عليها، أو للوصول إلى بيانات لا حق لك فيها، أو لتعطيل الخدمة على غيرك.',
      ],
    },
    {
      title: 'التوفر والمسؤولية',
      body: [
        'نعمل على إبقاء هَبّي متاحاً ودقيقاً، لكنه يعتمد على متاجر وشركات شحن وشبكات خارجية لا نتحكم بها، ويُقدَّم كما هو. بالقدر الذي يسمح به النظام، لا يتحمل هَبّي الخسائر غير المباشرة مثل فوات المبيعات أو الأرباح، وتقتصر مسؤوليته الإجمالية على ما دفعته مقابل الخدمة في الأشهر الثلاثة السابقة للمطالبة.',
      ],
    },
    {
      title: 'إنهاء الاتفاق',
      body: [
        'يمكنك التوقف عن استخدام هَبّي وطلب حذف حسابك في أي وقت. قد نوقف حساباً يخالف هذه الشروط، بعد إبلاغك بالسبب متى أمكن.',
      ],
    },
    {
      title: 'التغييرات والتواصل',
      body: [
        'قد نحدّث هذه الشروط. إذا كان التغيير مهماً فسنبلغك داخل التطبيق أو بالبريد قبل سريانه.',
        `للاستفسار عن هذه الشروط: ${CONTACT}.`,
      ],
    },
  ],
};

export default function TermsPage() {
  return <LegalPage en={en} ar={ar} />;
}
