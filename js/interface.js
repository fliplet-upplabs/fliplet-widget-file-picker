document.documentElement.classList.add('provider-' + Fliplet.Env.get('providerMode'));

var $imagesContainer = $('.image-library');
var $fileDropDown = $('#drop-down-file-source');
var $dropZone = $('#drop-zone');
var $fileInput = $('#upload-file');
var $spinnerHolder = $('.spinner-holder');
var $addDropDownMenuBtn = $('#add-drop-down-menu');
var $addMenu = $('#add-menu');
var $progressBar = $('#progress-bar');
var $progressLine = $('#progress-line');
var $progressBarWrapper = $('#progress-bar-wrapper');
var $cancelUploadButton = $('#cancel-upload');
var $alertWrapper = $('#alert-wrapper');

var data = Fliplet.Widget.getData() || {};

data.type = data.type || '';
data.selectFiles = data.selectFiles || [];
data.autoSelectOnUpload = data.autoSelectOnUpload || false;

if (!Array.isArray(data.selectFiles)) data.selectFiles = [data.selectFiles];
data.fileExtension = data.fileExtension || [];
data.selectMultiple = data.selectMultiple || false;
if (!(data.selectMultiple && data.selectFiles.length > 1) && !data.selectFiles) data.selectFiles = [data.selectFiles[0]];

if (data.type === 'folder') {
  $('#actionUploadFile').remove();
}

var templates = {};
var upTo = [];
var apps = [],
  organizations = [],
  folders = [],
  files = [];

var validType = [
  'image',
  'document',
  'video',
  'folder'
];

var isCancelClicked;
var forceDropDownInit;

['app', 'image', 'document', 'other', 'video', 'folder', 'organization', 'nofiles']
.forEach(function(tpl) {
  templates[tpl] = Fliplet.Widget.Templates['templates.' + tpl];
});

var extensionDictionary = {
  'image': [
    'jpg',
    'png',
    'jpeg',
    'gif',
    'tiff'
  ],
  'document': [
    'pdf',
    'doc',
    'docx',
    'keynote',
    'ppx',
    'ppt',
    'pptx',
    'txt',
    'xls',
    'xlsx'

  ],
  'video': [
    'mov',
    'mp4',
    'avi',
    'mpeg',
    'mpg',
    'wmv',
    'flv',
    '3gpp',
    'webm'
  ]
};


$('[data-toggle="tooltip"]').tooltip();
$('#browser-label').text('Browse ' + (data.type === 'folder' ? 'folders' : 'files') + ' in');

var validExtensions = [];
Object.keys(extensionDictionary).forEach(function(key) {
  extensionDictionary[key].forEach(function(ext) {
    validExtensions.push({
      type: key,
      ext: ext
    });
  })
});

function getFilteredType(extension) {
  var fileExtension = validExtensions.find(function(valid) {
    return valid.ext === extension
  });
  extension = extension.toLowerCase();
  var type = ((data.fileExtension.some(function(ext) {
      return extension === ext.toLowerCase();
    }) || !data.fileExtension.length) && fileExtension) ?
    fileExtension.type : 'others';
  return (type === data.type || data.type === '') ? type : 'others';
}

function getFileTemplate(file) {
  var extension;

  if (file.contentType) {
    switch (file.contentType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        extension = 'jpg';
        break;
      case 'image/gif':
        extension = 'gif';
        break;
      case 'image/png':
        extension = 'png';
        break;
    }
  }

  extension = extension || (file.thumbnail || file.url).split('.').pop();

  file.ext = extension;
  var type = getFilteredType(extension);

  var template;
  switch (type) {
    case 'image':
      file.urlSmall = file.thumbnail || Fliplet.Env.get('apiUrl') + 'v1/media/files/' + file.id + '/contents?size=small';
      template = templates.image(file);
      break;
    case 'video':
      template = templates.video(file);
      break;
    case 'others':
      template = templates.other(file);
      break;
    case 'document':
      template = templates.document(file);
      break;
  }

  return template
}

function addFile(file) {
  file.fullname = file.url.substring(file.url.lastIndexOf('/') + 1);
  $imagesContainer.append(getFileTemplate(file));
}

function addFolder(folder) {
  $imagesContainer.append(templates.folder(folder));
}

function noFiles() {
  $imagesContainer.html(templates.nofiles());
}

// events
$('#app')
  .on('click', '#help_tip', function() {
    alert("During beta, please use live chat and let us know what you need help with.");
  });

$('.image-library')
  .on('click', '.file', onFileClick)
  .on('click', '[data-folder-id]', onFolderClick)
  .on('dblclick', '[data-folder-id]', onFolderDbClick);

$('#actionNewFolder')
  .on('click', createFolder);

$('#actionUploadFile')
  .on('click', uploadFile);

function sortByName(item1, item2) {
  return byLowerCaseName(item1) > byLowerCaseName(item2);
}


function getApps() {
  return Fliplet.Apps
    .get()
    .then(function(apps) {
      return apps.sort(sortByName).filter(function(app) {
        return !app.legacy;
      })
    });
}

function getOrganizations() {
  return Fliplet.Organizations
    .get()
    .then(function(organisations) {
      return organisations
    })
}

function openFolder(folderId) {
  $spinnerHolder.removeClass('hidden');
  return getFolderAndFiles({
      folderId: folderId
    })
    .then(renderFolderContent)
    .then(function() {
      updatePaths();
      $spinnerHolder.addClass('hidden');
    })
}

function openApp(appId) {
  $spinnerHolder.removeClass('hidden');
  return getFolderAndFiles({
      appId: appId
    })
    .then(renderFolderContent)
    .then(function() {
      updatePaths();
      $spinnerHolder.addClass('hidden');
    })
}

function openOrganization(organizationId) {
  $spinnerHolder.removeClass('hidden');
  return getFolderAndFiles({
      organizationId: organizationId
    })
    .then(renderFolderContent)
    .then(function() {
      updatePaths();
      $spinnerHolder.addClass('hidden');
    })
}

function getFolderAndFiles(filter) {
  // Default filter functions
  var filterFiles = function(files) {
    return true;
  };
  var filterFolders = function(folders) {
    return true;
  };

  if (Object.keys(filter).indexOf('appId') > -1) {
    // Filter functions
    filterFiles = function(file) {
      return !file.mediaFolderId;
    };
    filterFolders = function(folder) {
      return !folder.parentFolderId;
    };
  } else if (Object.keys(filter).indexOf('organizationId') > -1) {

    // Filter functions
    filterFiles = function(file) {
      return !(file.appId || file.mediaFolderId);
    };
    filterFolders = function(folder) {
      return !(folder.appId || folder.parentFolderId);
    };
  }

  function filterResponse(response) {
    // Filter only the files from that request app/org/folder
    var files = response.files.filter(filterFiles);
    var folders = response.folders.filter(filterFolders);

    return Promise.resolve({ files: files, folders: folders });
  }


  return Promise.all([
    Fliplet.Media.Folders.get(Object.assign({}, {
      type: 'folders'
    }, filter)).then(filterResponse),
    Fliplet.Media.Folders.get(Object.assign({}, {
      type: data.fileExtension.length > 0 ? data.fileExtension.map(function(type) {
        return type.toLowerCase();
      }).join(',') : data.type
    }, filter)).then(filterResponse)
  ])
}

function renderFolderContent(values) {
  folders = values[0].folders;
  files = values[1].files;
  emitSelected();

  drawContentItems();
}

function unselectAll() {
  files.forEach(function(file) {
    return file.selected = false;
  });

  folders.forEach(function(folder) {
    return folder.selected = false;
  });

  $('.selected').removeClass('selected');
}

function selectFile(id) {
  if (data.type === 'folder') return;
  var file = files.find(function(file) {
    return file.id === id;
  });
  if (!file) return;
  if (!extensionClickFilter(file.url.split('.').pop())) return;

  var isSelected = !file.selected;
  if (!data.selectMultiple) unselectAll();
  file.selected = isSelected;

  var $el = $('.file[data-file-id=' + id + ']');
  $el[!!file.selected ? 'addClass' : 'removeClass']('selected');
  emitSelected();
}

function selectFolder(id) {
  if (!(data.type === 'folder' || data.type === '')) return;

  var folder = folders.find(function(folder) {
    return folder.id === id;
  });
  if (!folder) return;

  var isSelected = !folder.selected;
  if (!data.selectMultiple) unselectAll();
  folder.selected = isSelected;

  var $el = $('.folder[data-folder-id=' + id + ']');
  $el[!!folder.selected ? 'addClass' : 'removeClass']('selected');

  emitSelected();
}

function selectItems(items) {
  items.forEach(function(item) {
    if (!item.contentType) {
      selectFolder(item.id)
    } else if (item.contentType) {
      selectFile(item.id)
    }
  });
}

function restoreRoot(appId, organizationId) {
  forceDropDownInit = true;
  var backItem;
  if (appId) {
    backItem = _.find(apps, ['id', appId]);
    backItem.back = function() {
      return openApp(appId);
    };
    backItem.name = 'Root';
    backItem.type = 'appId';
    initDropDownState('app_' + appId);
  } else if (organizationId) {
    backItem = _.find(organizations, ['id', organizationId]);
    backItem.back = function() {
      return openOrganization(organizationId);
    };
    backItem.name = 'Root';
    backItem.type = 'organizationId';
    initDropDownState('org_' + organizationId);
  }
  upTo.unshift(backItem);

  return Promise.resolve();
}

function restoreFolders(id, appId, organizationId) {
  if (!id) {
    return restoreRoot(appId, organizationId);
  }

  return Fliplet.API.request({
      url: 'v1/media/folders/' + id
    })
    .then(function(res) {
      var backItem = res;
      // Store to nav stack
      backItem.back = function() {
        return openFolder(id);
      };
      backItem.type = 'parentId';
      upTo.unshift(backItem);

      return restoreFolders(res.parentId, res.appId, res.organizationId);

    });
}

function restoreFoldersPath(lastFolderid, appId, organizationId) {
  return restoreFolders(lastFolderid, appId, organizationId)
    .then(function() {
      return upTo[upTo.length - 1].back();
    });
}

function restoreWidgetState() {
  var file = data.selectFiles[0];
  return restoreFoldersPath(file.mediaFolderId || file.parentId, file.appId, file.organizationId)
    .then(function() {
      return selectItems(data.selectFiles);
    }, function() {
      return defaultInitWidgetState();
    })
}

function getSelectedFilesData() {
  return files
    .filter(function(file) {
      return file.selected
    });
}

function getSelectedFoldersData() {
  return folders
    .filter(function(folder) {
      return folder.selected
    });
}

//  Get object with selected files/folders data
function getSelectedData() {
  var result = [].concat(getSelectedFoldersData(), getSelectedFilesData());
  return result;
}

//  Send selected items data to parent widget
function emitSelected() {
  Fliplet.Widget.emit('widget-set-info', getSelectedData());
}


function onFolderClick(e) {
  e.preventDefault();
  var $el = $(this);
  selectFolder($el.data('folder-id'));
}

function onFolderDbClick(e) {
  e.preventDefault();
  var $el = $(this);

  var id = $el.data('folder-id');
  var backItem;

  // Store to nav stack
  backItem = _.find(folders, ['id', id]);
  backItem.back = function() {
    return openFolder(id);
  };
  backItem.type = 'parentId';
  upTo.push(backItem);

  // Open
  openFolder(id);

}

function onFileClick(e) {
  e.preventDefault();
  var $el = $(this);
  selectFile($el.data('file-id'));
}


function extensionClickFilter(extension) {
  var type = getFilteredType(extension);

  if ((!data.type || data.type === type) && type != 'others')
    return true;
  return false;
}



$('.back-btn').click(function() {
  if (upTo.length === 0) {
    return;
  }

  upTo.pop();
  upTo[upTo.length - 1]
    .back()
    .then(function() {
      updatePaths();
    });
});

function updatePaths() {
  if (upTo.length === 0) {
    // Hide them
    $('.gallery-tool').removeClass('with-tools');
    $('.back-btn').hide();
    $('.helper').hide();

    return;
  }

  // Show them
  $('.gallery-tool').addClass('with-tools');
  $('.helper').show();
  $('.back-btn').show();

  // Parent folder
  if (upTo.length < 2) {
    $('.helper').hide();
    $('.back-btn').hide();
  } else {
    //hide

    $('.up-to').html(upTo[upTo.length - 2].name);
    $('.helper').show();
    $('.back-btn').show();
  }
  $('.helper').html(upTo[upTo.length - 1].name);
}

function initDropDownState(id) {
  $fileDropDown.prop('disabled', '');
  $fileDropDown.val(id);
  $fileDropDown.trigger('change');
}

function defaultInitWidgetState() {
  forceDropDownInit = false;

  if (apps.find(function(app) {
      return app.id === Fliplet.Env.get('appId');
    })) {
    initDropDownState('app_' + Fliplet.Env.get('appId'));
    return;
  }

  if (apps.length) {
    initDropDownState('app_' + apps[0].id);
    return;
  }

  initDropDownState('org_' + organizations[0].id);
}

function initWidgetState() {
  if (data.selectFiles.length) {
    return restoreWidgetState();
  }
  defaultInitWidgetState();

  $fileDropDown.trigger('change');
}

function renderApp(id) {
  var backItem;
  backItem = _.find(apps, ['id', id]);
  backItem.name = 'Root';
  backItem.back = function() {
    return openApp(id);
  };
  backItem.type = 'appId';
  upTo = [backItem];
  openApp(id);
}

function renderOrganization(id) {
  var backItem;
  backItem = _.find(organizations, ['id', id]);
  backItem.name = 'Root';
  backItem.back = function() {
    return openOrganization(id);
  };
  backItem.type = 'organizationId';
  backItem.id = id;

  upTo = [backItem];
  openOrganization(id);
}

function init() {
  Fliplet.Studio.emit('widget-rendered', {});
  Promise.all([
      getOrganizations(),
      getApps()
    ])
    .then(function(values) {
      let dropDownHtml = [];

      // Organisations
      if (values[0].length) {
        dropDownHtml.push('<optgroup label="--- Organisations ---">');
        values[0].sort(sortByName).forEach(function(organisation) {
          dropDownHtml.push('<option value="org_' + organisation.id + '">' + organisation.name + '</option>');
          organizations.push({
            id: organisation.id,
            name: organisation.name
          });
        });
        dropDownHtml.push('</optgroup>');
      }

      // Apps
      if (values[1].length) {
        dropDownHtml.push('<optgroup label="--- Apps ---">');
        values[1].sort(sortByName).forEach(function(app) {
          dropDownHtml.push('<option value="app_' + app.id + '">' + app.name + '</option>');
          apps.push({
            id: app.id,
            name: app.name
          });
        });
        dropDownHtml.push('</optgroup>');
      }

      $fileDropDown.append(dropDownHtml.join(''));

      // Removes disabled attribute to allow the user to use the drop-down

      $fileDropDown.change(function() {
        if (forceDropDownInit) {
          forceDropDownInit = false;
          return;
        }
        //drop down change handler
        var data = $fileDropDown.val().split('_');
        var type = data[0];
        var id = parseInt(data[1]);
        switch (type) {
          case 'app':
            renderApp(id);
            break;
          case 'org':
            renderOrganization(id);
            break;
          default:
            alert('Wrong select type: ' + type);
        }
      });
    })
    .then(function() {
      initWidgetState();
    });

  Fliplet.Widget.autosize();
}


Fliplet.Widget.onSaveRequest(function() {
  Fliplet.Widget.save(getSelectedData()).then(function() {
    Fliplet.Widget.complete();
  });
});

function uploadFile() {
  $fileInput.click();
}

function createFolder() {
  var folderName = prompt('Please enter the folder name');
  if (folderName === null) return;
  folderName = folderName || 'Untitled folder';

  var config = {
    name: folderName
  };
  config[upTo[0].type] = upTo[0].id;
  if (upTo.length > 1) {
    var item = upTo[upTo.length - 1];
    config[item.type] = item.id;
  }
  Fliplet.Media.Folders.create(config)
    .then(function(folder) {
      attachFolder(folder);
    });
}

function attachFolder(folder) {
  addFolderToFolders(folder);
}

function showDropZone() {
  $dropZone.show();
}

$fileInput.on('click', function(e) {
  e.stopPropagation();
});

$fileInput.on('change', function(e) {
  var files = e.target.files;
  if (!files.length) return;
  uploadFiles(files);
  clearFileInput();
});

function clearFileInput() {
  $fileInput.wrap('<form>').closest('form').get(0).reset();
  $fileInput.unwrap();
}

function hideDropZone() {
  $dropZone.hide();
}


function handleCancel(obj) {
  if (!isCancelClicked) return;
  obj.abort();
}

function uploadFiles(files) {

  var formData = new FormData();
  for (var i = 0; i < files.length; i++) {
    formData.append('' + i, files[i]);
  }

  var config = {
    data: formData,
    progress: function(perсent) {
      handleCancel(this);
      moveProgressBar(perсent);
    }
  };

  config[upTo[0].type] = upTo[0].id;
  if (upTo.length > 1) {
    var item = upTo[upTo.length - 1];
    config.folderId = item.id;
  }
  isCancelClicked = false;
  hideDropZone();
  showProgressBar();

  Fliplet.Media.Files.upload(config)
    .then(function(files) {
      var files = files;
      if (files.length) {
        addFilesToCurrentFiles(files);
      }
      if (data.autoSelectOnUpload) {
        files.forEach(function(file) {
          selectFile(file.id);
        })
      }
      hideProgressBar();

    })
    .then(function() {}, handleUploadingError);
}

function handleUploadingError(err) {
  hideProgressBar();
  if (isCancelClicked) return;
  showError();
}

function showError() {
  $alertWrapper.show();
  setTimeout(function() {
    $alertWrapper.hide()
  }, 3000);
}

function addFilesToCurrentFiles(newFiles) {
  files = files.concat(newFiles);
  drawContentItems();
}

function addFolderToFolders(folder) {
  folders.push(folder);
  drawContentItems();
}

function byLowerCaseName(item) {
  return item.name.toLowerCase();
}

function drawContentItems() {
  if (!folders.length && !files.length) {
    return noFiles();
  }

  $imagesContainer.empty();
  _.sortBy(folders, byLowerCaseName).forEach(addFolder);
  _.sortBy(files, byLowerCaseName).forEach(addFile);

  Fliplet.Widget.autosize();
}


$dropZone.on('drop', function(e) {
  e.preventDefault();
  var dataTransfer = e.originalEvent.dataTransfer;
  var files = dataTransfer.files;
  if (!files.length) return hideDropZone();
  uploadFiles(files);
});

$dropZone.on('dragover', function(e) {
  e.preventDefault();
});

$dropZone.on('dragleave', function(e) {
  e.preventDefault();
  hideDropZone();
});

$('html').on('dragenter', function(e) {
  e.preventDefault();
  showDropZone();
});

$addDropDownMenuBtn.on('click', function(e) {
  e.preventDefault();
  $addMenu.toggle();
});

$addDropDownMenuBtn.on('blur', function(e) {
  setTimeout(function() {
    $addMenu.hide();
  }, 200);
});

function showProgressBar() {
  $progressBarWrapper.show();
  moveProgressBar(1);
}

function hideProgressBar() {
  $progressBarWrapper.hide();
}

function moveProgressBar(to) {
  $progressLine.width(to + '%');
}

$cancelUploadButton.on('click', function(e) {
  e.preventDefault();
  isCancelClicked = true;
});

// init
init();
