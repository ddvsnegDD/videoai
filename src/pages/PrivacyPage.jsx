import LegalPage from '../components/LegalPage.jsx';
import { privacyMarkdown } from '../content/legal/privacy.js';

export default function PrivacyPage() {
  return <LegalPage markdown={privacyMarkdown} title="Политика конфиденциальности — VideoAI" />;
}
