import type { Metadata } from 'next';
import LegalPage, { type LegalDoc } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy — Hubby' };

const CONTACT = 'hello@hubbyglobal.com';

const en: LegalDoc = {
  title: 'Privacy Policy',
  updated: 'Last updated: 23 November 2026',
  intro:
    'Hubby is a service for merchants who sell on more than one online store. It brings their orders, products, stock and money into one place, on the web and in the Hubby mobile app. This policy says what information Hubby handles, why, and what you can do about it.',
  sections: [
    {
      title: 'Information you give us',
      body: [
        'Your account: your name, email address, password (stored as a one-way hash, never as plain text) and the name of your organisation.',
        'Your store connections: the address of each store or system you connect and the access keys you provide for it. These keys are encrypted before they are stored and are used only to read and update that store on your behalf.',
        'Your business settings: costs, expenses, tax registration details, shipping settings and the rules you set up.',
      ],
    },
    {
      title: 'Information that comes from your stores',
      body: [
        'When you connect a store, Hubby reads its products, stock levels, orders, returns and shipments. Orders include details of your own customers: their name, email address, phone number and delivery address, as your store holds them.',
        'You remain responsible for this customer information. Hubby processes it only to show it to you and to carry out what you ask, such as preparing a shipment or an invoice.',
      ],
    },
    {
      title: 'Information from your device',
      body: [
        'Notifications: if you allow notifications in the mobile app, your device receives a notification token through Firebase Cloud Messaging so that Hubby can send you alerts.',
        'Camera: the mobile app uses the camera to scan barcodes in the warehouse and to take product photos. Barcode scanning happens on your device. A photo is uploaded only when you choose to attach it to a product.',
        'Hubby does not include advertising software and does not track you across other apps or websites.',
      ],
    },
    {
      title: 'How we use information',
      body: [
        'To run the service: sync your stores, show your orders and stock, calculate profit, prepare shipments, returns and invoices, and send you the alerts you asked for.',
        'To keep the service secure, fix problems and answer your support requests.',
        'We do not sell your information, and we do not use your customers’ details for our own marketing.',
      ],
    },
    {
      title: 'Who we share it with',
      body: [
        'The stores, marketplaces, shipping carriers and accounting systems you connect, to the extent needed to do what you ask: for example, sending a stock level to a marketplace or an address to a carrier.',
        'Service providers that help us run Hubby, such as hosting, email delivery, notifications and payment processing for subscriptions. They may use the information only to provide their service to us.',
        'Authorities, when the law requires it.',
      ],
    },
    {
      title: 'How long we keep it',
      body: [
        'We keep your information while your account is open. When you disconnect a store, Hubby stops reading it and removes the stored access keys for it.',
        'When you ask us to delete your account, we delete your account and your organisation’s data, except records we must keep by law, such as issued tax invoices.',
      ],
    },
    {
      title: 'Your choices',
      body: [
        'You can see and correct your account details in Settings, disconnect any store at any time, and turn notifications off on your device.',
        `To get a copy of your information or to have your account and data deleted, write to ${CONTACT} from the email address on your account.`,
      ],
    },
    {
      title: 'Security',
      body: [
        'Connections to Hubby are encrypted. Store access keys are encrypted at rest. Access to an organisation’s data is limited to the people that organisation has invited. No system is perfectly secure, and we will tell you if a breach affects your information.',
      ],
    },
    {
      title: 'Children',
      body: ['Hubby is a business tool and is not intended for anyone under 18.'],
    },
    {
      title: 'Changes and contact',
      body: [
        'If this policy changes in a way that matters, we will tell you in the app or by email before the change takes effect.',
        `Questions about this policy: ${CONTACT}.`,
      ],
    },
  ],
};

const ar: LegalDoc = {
  title: 'سياسة الخصوصية',
  updated: 'آخر تحديث: 23 نوفمبر 2026',
  intro:
    'هَبّي خدمة للتجار الذين يبيعون عبر أكثر من متجر إلكتروني. تجمع طلباتهم ومنتجاتهم ومخزونهم وأموالهم في مكان واحد، على الويب وفي تطبيق هَبّي للجوال. توضح هذه السياسة المعلومات التي يتعامل معها هَبّي، ولماذا، وما الذي يمكنك فعله حيالها.',
  sections: [
    {
      title: 'المعلومات التي تقدمها لنا',
      body: [
        'حسابك: اسمك وبريدك الإلكتروني وكلمة المرور (تُحفظ مشفرة باتجاه واحد وليست كنص مقروء) واسم منشأتك.',
        'ربط متاجرك: عنوان كل متجر أو نظام تربطه ومفاتيح الوصول التي تقدمها له. تُشفَّر هذه المفاتيح قبل حفظها وتُستخدم فقط لقراءة ذلك المتجر وتحديثه نيابة عنك.',
        'إعدادات عملك: التكاليف والمصروفات وبيانات التسجيل الضريبي وإعدادات الشحن والقواعد التي تضبطها.',
      ],
    },
    {
      title: 'المعلومات القادمة من متاجرك',
      body: [
        'عند ربط متجر، يقرأ هَبّي منتجاته ومستويات مخزونه وطلباته ومرتجعاته وشحناته. تتضمن الطلبات بيانات عملائك أنت: الاسم والبريد الإلكتروني ورقم الجوال وعنوان التوصيل كما هي محفوظة في متجرك.',
        'تبقى أنت المسؤول عن بيانات عملائك. يعالجها هَبّي فقط لعرضها عليك وتنفيذ ما تطلبه، مثل تجهيز شحنة أو فاتورة.',
      ],
    },
    {
      title: 'المعلومات من جهازك',
      body: [
        'الإشعارات: إذا سمحت بالإشعارات في تطبيق الجوال، يحصل جهازك على رمز إشعارات عبر Firebase Cloud Messaging ليتمكن هَبّي من إرسال التنبيهات إليك.',
        'الكاميرا: يستخدم التطبيق الكاميرا لمسح الباركود في المستودع ولتصوير المنتجات. يتم مسح الباركود على جهازك، ولا تُرفع الصورة إلا عندما تختار إرفاقها بمنتج.',
        'لا يتضمن هَبّي برمجيات إعلانية ولا يتتبعك عبر تطبيقات أو مواقع أخرى.',
      ],
    },
    {
      title: 'كيف نستخدم المعلومات',
      body: [
        'لتشغيل الخدمة: مزامنة متاجرك، وعرض طلباتك ومخزونك، وحساب الأرباح، وتجهيز الشحنات والمرتجعات والفواتير، وإرسال التنبيهات التي طلبتها.',
        'للحفاظ على أمان الخدمة وإصلاح المشكلات والرد على طلبات الدعم.',
        'لا نبيع معلوماتك، ولا نستخدم بيانات عملائك لتسويقنا.',
      ],
    },
    {
      title: 'مع من نشاركها',
      body: [
        'المتاجر والمنصات وشركات الشحن والأنظمة المحاسبية التي تربطها، بالقدر اللازم لتنفيذ ما تطلبه: مثل إرسال مستوى المخزون إلى منصة أو عنوان إلى شركة شحن.',
        'مزودو الخدمات الذين يساعدوننا في تشغيل هَبّي، مثل الاستضافة وإرسال البريد والإشعارات ومعالجة مدفوعات الاشتراكات. لا يحق لهم استخدام المعلومات إلا لتقديم خدمتهم لنا.',
        'الجهات الرسمية عندما يوجب النظام ذلك.',
      ],
    },
    {
      title: 'مدة الاحتفاظ',
      body: [
        'نحتفظ بمعلوماتك ما دام حسابك مفتوحاً. عند فصل متجر يتوقف هَبّي عن قراءته ويحذف مفاتيح الوصول المحفوظة له.',
        'عند طلبك حذف حسابك نحذف الحساب وبيانات منشأتك، عدا السجلات التي يلزمنا النظام بحفظها مثل الفواتير الضريبية الصادرة.',
      ],
    },
    {
      title: 'خياراتك',
      body: [
        'يمكنك الاطلاع على بيانات حسابك وتصحيحها من الإعدادات، وفصل أي متجر في أي وقت، وإيقاف الإشعارات من جهازك.',
        `للحصول على نسخة من معلوماتك أو لحذف حسابك وبياناتك، راسلنا على ${CONTACT} من البريد المسجل في حسابك.`,
      ],
    },
    {
      title: 'الأمان',
      body: [
        'الاتصال بهَبّي مشفر. مفاتيح الوصول للمتاجر مشفرة عند الحفظ. الوصول إلى بيانات المنشأة مقصور على من دعتهم المنشأة. لا يوجد نظام آمن تماماً، وسنبلغك إذا أثّر اختراق على معلوماتك.',
      ],
    },
    {
      title: 'الأطفال',
      body: ['هَبّي أداة أعمال وليس موجهاً لمن هم دون 18 عاماً.'],
    },
    {
      title: 'التغييرات والتواصل',
      body: [
        'إذا تغيرت هذه السياسة تغييراً مهماً فسنبلغك داخل التطبيق أو بالبريد قبل سريان التغيير.',
        `للاستفسار عن هذه السياسة: ${CONTACT}.`,
      ],
    },
  ],
};

export default function PrivacyPage() {
  return <LegalPage en={en} ar={ar} />;
}
