import React from 'react';
import ReactMarkdown from 'react-markdown';
import { C } from '../lib/theme.js';

const containerStyle = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '48px 24px 80px',
};

const proseStyle = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontSize: '0.9375rem',
  lineHeight: 1.7,
  color: C.dark,
};

const components = {
  h1: ({ children }) => (
    <h1 style={{
      fontFamily: "'Manrope', sans-serif",
      fontSize: '1.75rem',
      fontWeight: 800,
      color: C.dark,
      marginBottom: 8,
      lineHeight: 1.3,
    }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{
      fontFamily: "'Manrope', sans-serif",
      fontSize: '1.25rem',
      fontWeight: 700,
      color: C.dark,
      marginTop: 36,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: `1px solid ${C.gray200}`,
    }}>{children}</h2>
  ),
  p: ({ children }) => (
    <p style={{ marginBottom: 12, lineHeight: 1.7 }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 24, marginBottom: 12 }}>{children}</ul>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 6, lineHeight: 1.6 }}>{children}</li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: C.dark }}>{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: C.primary, textDecoration: 'underline', textUnderlineOffset: 2 }}
    >{children}</a>
  ),
};

export default function LegalPage({ markdown, title }) {
  return (
    <div style={containerStyle}>
      {title && (
        <title>{title}</title>
      )}
      <div style={proseStyle}>
        <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
