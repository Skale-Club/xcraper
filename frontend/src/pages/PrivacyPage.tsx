import LegalPageLayout from '@/components/LegalPageLayout';

export default function PrivacyPage() {
    return (
        <LegalPageLayout
            title="Privacy Policy"
            description="This Privacy Policy explains what information Xcraper collects, how it is used, how long it is retained, and what choices users have when using the platform."
        >
            <section>
                <h2>Information We Collect</h2>
                <p>
                    We collect information you provide directly, such as your name, email
                    address, account profile details, billing events, support requests, and any
                    information you submit while using the platform. We also collect technical
                    usage data needed to operate, secure, and improve the service.
                </p>
                <ul>
                    <li>Account details such as name, email address, avatar, company, and phone number.</li>
                    <li>Usage records such as searches, saved contacts, exports, and credit transactions.</li>
                    <li>Technical data such as IP address, browser details, device information, and log events.</li>
                </ul>
            </section>

            <section>
                <h2>How We Use Information</h2>
                <p>
                    We use collected information to authenticate users, provide platform
                    features, process payments, prevent abuse, maintain service reliability, and
                    communicate with you about your account and product updates.
                </p>
            </section>

            <section>
                <h2>How Search and Contact Data Is Handled</h2>
                <p>
                    Search results and saved contacts are stored to support your workspace,
                    exports, credit accounting, and product functionality. You control the contact
                    data saved within your account and are responsible for your downstream use of
                    exported information.
                </p>
            </section>

            <section>
                <h2>Legal Bases and Compliance</h2>
                <p>
                    Where applicable, we process information based on contractual necessity,
                    legitimate interests in operating and securing the platform, compliance with
                    legal obligations, and consent where required. If you use the platform in a
                    regulated environment, you remain responsible for your own compliance duties.
                </p>
            </section>

            <section>
                <h2>Sharing of Information</h2>
                <p>
                    We do not sell your personal information. We may share limited information
                    with trusted service providers that help us run the platform, such as hosting,
                    authentication, payments, analytics, and scraping infrastructure providers.
                    We may also disclose information when required by law or to protect the
                    security of the service.
                </p>
            </section>

            <section>
                <h2>Data Retention</h2>
                <p>
                    We retain account and operational data for as long as needed to provide the
                    service, maintain business records, resolve disputes, enforce agreements, and
                    satisfy legal obligations. We may delete or anonymize data when it is no
                    longer required for those purposes.
                </p>
            </section>

            <section>
                <h2>Security</h2>
                <p>
                    We use reasonable administrative, technical, and organizational safeguards to
                    protect platform data. No system is perfectly secure, and we cannot guarantee
                    absolute security of information transmitted or stored through the service.
                </p>
            </section>

            <section>
                <h2>Your Choices</h2>
                <p>
                    You can update certain profile details inside the platform, request account
                    changes, and stop using the service at any time. Depending on your
                    jurisdiction, you may also have rights related to access, correction, deletion,
                    portability, or objection to certain processing.
                </p>
            </section>

            <section>
                <h2>International Transfers</h2>
                <p>
                    If you access Xcraper from outside the country where our providers operate,
                    your information may be transferred to and processed in other jurisdictions
                    where data protection laws may differ from those in your location.
                </p>
            </section>

            <section>
                <h2>Changes to This Policy</h2>
                <p>
                    We may update this Privacy Policy from time to time. The revised version will
                    be posted on this page, and your continued use of the platform after the
                    update takes effect will indicate acceptance of the revised policy.
                </p>
            </section>

            <section>
                <h2>Contact</h2>
                <p>
                    If you have privacy questions or requests, contact the Xcraper support team
                    through the contact details made available in the platform.
                </p>
            </section>
        </LegalPageLayout>
    );
}
