// Inline SVG icons (stroke style, 24x24). Shared by the site and the admin page.
(function () {
  const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  // Icons the admin can pick for service cards.
  const SERVICE = {
    tooth: svg('<path d="M7.5 3C5 3 3 5 3 7.6c0 2.1.8 3.5 1.5 5.1.7 1.6.9 3.3 1.2 5.1.3 1.9.8 3.2 2 3.2 1.4 0 1.6-1.8 1.9-3.4.3-1.6.8-3.1 2.4-3.1s2.1 1.5 2.4 3.1c.3 1.6.5 3.4 1.9 3.4 1.2 0 1.7-1.3 2-3.2.3-1.8.5-3.5 1.2-5.1.7-1.6 1.5-3 1.5-5.1C21 5 19 3 16.5 3c-1.9 0-2.8 1-4.5 1s-2.6-1-4.5-1z"/>'),
    sparkle: svg('<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    shield: svg('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>'),
    smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
    implant: svg('<path d="M7.5 3.5h9c.3 2.6-.7 4.5-3 4.5h-3c-2.3 0-3.3-1.9-3-4.5z"/><path d="M10 8v9.5l2 3 2-3V8"/><path d="M9 11h6M9.4 14h5.2M10 17h4"/>'),
    braces: svg('<path d="M3 12h18"/><rect x="4.5" y="9" width="4" height="6" rx="1"/><rect x="10" y="9" width="4" height="6" rx="1"/><rect x="15.5" y="9" width="4" height="6" rx="1"/>'),
    scan: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M9.5 8.5c-1 0-1.8.8-1.8 1.9 0 1.6 1 2.4 1.2 4.6.1.8.4 1.5.9 1.5.6 0 .7-.9.9-1.6.1-.5.4-.9 1.3-.9s1.2.4 1.3.9c.2.7.3 1.6.9 1.6.5 0 .8-.7.9-1.5.2-2.2 1.2-3 1.2-4.6 0-1.1-.8-1.9-1.8-1.9-.9 0-1.4.5-2.5.5s-1.6-.5-2.5-.5z"/>'),
    syringe: svg('<path d="M18 2l4 4M17 7l3-3M19 9 9.5 18.5 5 19l.5-4.5L15 5z"/><path d="M12.5 7.5l2 2M10 10l2 2M2 22l3.5-3.5"/>'),
    heart: svg('<path d="M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.6-7.5 10-7.5 10z"/>'),
    child: svg('<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-2-3.5L9 10h6l3 2.5-2 3.5v5"/><path d="M10.5 6.2h.01M13.5 6.2h.01"/>'),
    microscope: svg('<path d="M6 18h12M8 21h8M9 4l4 2-3 6-4-2z"/><path d="M11 12c4 0 6 2 6 6M13 6l1-2"/>'),
    clipboard: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>')
  };

  const UI = {
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>'),
    phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    mail: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 7l9 6 9-6"/>'),
    pin: svg('<path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    cap: svg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/>'),
    briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'),
    award: svg('<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>'),
    book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'),
    camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    chevLeft: svg('<path d="M15 18l-6-6 6-6"/>'),
    chevRight: svg('<path d="M9 18l6-6-6-6"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 0 1 12 2.2a9.8 9.8 0 0 1 9.8 9.8c0 5.4-4.4 9.8-9.8 9.8zm0-21.5C5.6.3.4 5.5.4 12c0 2 .5 4 1.6 5.8L.3 23.7l6-1.6A11.6 11.6 0 0 0 12 23.6c6.4 0 11.6-5.2 11.6-11.6S18.4.3 12 .3z"/></svg>'
  };

  window.Icons = { SERVICE, UI, service: (name) => SERVICE[name] || SERVICE.tooth };
})();
