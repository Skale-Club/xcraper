import LegalPageLayout from '@/components/LegalPageLayout';

export default function TermsPage() {
    return (
        <LegalPageLayout
            title="Terms of Service"
            description="These Terms of Service govern access to and use of the Xcraper platform, including account access, scraping workflows, exports, billing, and related support."
        >
            <section>
                <h2>Acceptance of Terms</h2>
                <p>
                    By accessing or using Xcraper, you agree to be bound by these Terms of
                    Service. If you use the service on behalf of a company or other legal
                    entity, you represent that you have authority to bind that entity to these
                    terms.
                </p>
            </section>

            <section>
                <h2>Eligibility and Accounts</h2>
                <p>
                    You must provide accurate registration information and keep your login
                    credentials secure. You are responsible for all activity that occurs through
                    your account and must notify us promptly if you suspect unauthorized access.
                </p>
            </section>

            <section>
                <h2>Permitted Use</h2>
                <p>
                    You may use Xcraper to research and organize publicly available business
                    information for lawful internal business purposes. You agree not to use the
                    platform in a way that violates applicable law, infringes third-party rights,
                    or breaches the terms of any third-party service you rely on.
                </p>
                <ul>
                    <li>You may not use the service for spam, fraud, harassment, or deceptive outreach.</li>
                    <li>You may not attempt to interfere with the platform, reverse engineer it, or bypass usage controls.</li>
                    <li>You may not resell platform access without prior written permission.</li>
                </ul>
            </section>

            <section>
                <h2>Data and User Responsibility</h2>
                <p>
                    Xcraper helps collect and structure data that appears to be publicly
                    available. You are solely responsible for reviewing the data you export or
                    act on, determining whether it is appropriate for your use case, and
                    complying with privacy, marketing, and consumer protection laws that apply to
                    your business.
                </p>
            </section>

            <section>
                <h2>Credits, Billing, and Payments</h2>
                <p>
                    Certain features require credits. Credits are deducted according to the
                    pricing and usage rules shown in the platform at the time of use. Purchases
                    are processed through third-party payment providers. Except where required by
                    law, purchased credits are non-refundable once used.
                </p>
            </section>

            <section>
                <h2>Availability and Service Changes</h2>
                <p>
                    We may update, suspend, or discontinue parts of the platform from time to
                    time. We do not guarantee uninterrupted availability or that every external
                    data source will remain accessible. We may also impose usage limits to protect
                    platform reliability and security.
                </p>
            </section>

            <section>
                <h2>Termination</h2>
                <p>
                    We may suspend or terminate access if we reasonably believe you violated
                    these terms, created legal or security risk, or used the platform in a way
                    that harms other users or the service. You may stop using the platform at any
                    time.
                </p>
            </section>

            <section>
                <h2>Disclaimers</h2>
                <p>
                    Xcraper is provided on an &quot;as is&quot; and &quot;as available&quot;
                    basis. To the maximum extent permitted by law, we disclaim warranties of
                    merchantability, fitness for a particular purpose, non-infringement, and data
                    accuracy. We do not guarantee that scraped or exported information is complete,
                    current, or error-free.
                </p>
            </section>

            <section>
                <h2>Limitation of Liability</h2>
                <p>
                    To the maximum extent permitted by law, Xcraper and its operators will not be
                    liable for indirect, incidental, special, consequential, exemplary, or
                    punitive damages, or for lost profits, revenues, business opportunities, data,
                    or goodwill arising from or related to your use of the service.
                </p>
            </section>

            <section>
                <h2>Changes to These Terms</h2>
                <p>
                    We may revise these terms periodically. When we do, the updated version will
                    be posted on this page. Your continued use of the platform after changes
                    become effective constitutes acceptance of the revised terms.
                </p>
            </section>

            <section>
                <h2>Contact</h2>
                <p>
                    For questions about these terms, contact the Xcraper support team through the
                    contact details provided in the platform.
                </p>
            </section>
        </LegalPageLayout>
    );
}
