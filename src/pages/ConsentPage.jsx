import LegalPage from '../components/LegalPage.jsx';
import { consentMarkdown } from '../content/legal/consent.js';

export default function ConsentPage() {
  return <LegalPage markdown={consentMarkdown} title="Согласие на обработку персональных данных — VideoAI" />;
}
