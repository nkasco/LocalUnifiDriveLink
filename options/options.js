document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('driveLink');
  const saveBtn = document.getElementById('save');
  const openBtn = document.getElementById('open');

  function load() {
    chrome.storage.sync.get({ driveLink: '', delayedCreate: 5 }, (items) => {
      input.value = items.driveLink || '';
      const d = Number(items.delayedCreate || 5);
      document.getElementById('delayedCreate').value = isNaN(d) ? 5 : d;
    });
  }

  saveBtn.addEventListener('click', () => {
    const val = input.value.trim();
    const delayVal = Number(document.getElementById('delayedCreate').value) || 0;
    chrome.storage.sync.set({ driveLink: val, delayedCreate: delayVal }, () => {
      saveBtn.textContent = 'Saved!';
      setTimeout(() => (saveBtn.textContent = 'Save'), 1200);
    });
  });

  openBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val) window.open(val, '_blank');
    else alert('Please enter a link first');
  });

  load();
});
