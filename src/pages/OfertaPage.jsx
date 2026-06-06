import LegalPage from '../components/LegalPage.jsx';
import { ofertaMarkdown } from '../content/legal/oferta.js';

export default function OfertaPage() {
  return <LegalPage markdown={ofertaMarkdown} title="Публичная оферта — VideoAI" />;
}
