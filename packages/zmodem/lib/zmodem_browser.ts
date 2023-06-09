import { ZmodemError } from './zerror'
import { Transfer, ZmodemSendSession, ZmodemSession } from './zsession'
import { Octets } from './encode'

function _check_aborted(session: ZmodemSession) {
  if (session.aborted()) {
    throw new ZmodemError('aborted')
  }
}

interface SendFileOptions {
  on_offer_response?: (file: File, xfer?: Transfer) => void
  on_progress?: (file: File, xfer: Transfer, chunk: Uint8Array) => void
  on_file_complete?: (file: File, xfer: Transfer) => void
}

interface SendBlockFileOptions extends SendFileOptions {
  block?: number
}

interface FileObj {
  obj: File
  name: string
  size: number
  mtime: Date
  files_remaining: number
  bytes_remaining: number
}

/** Browser-specific tools
 *
 * @exports Browser
 */
export const Browser = {
  /**
   * Send a batch of files in sequence. The session is left open
   * afterward, which allows for more files to be sent if desired.
   *
   * @param {Zmodem.Session} session - The send session
   *
   * @param {FileList|Array} files - A list of File objects
   *
   * @param {Object} [options]
   * @param {Function} [options.on_offer_response] - Called when an
   * offer response arrives. Arguments are:
   *
   * - (File) - The File object that corresponds to the offer.
   * - (Transfer|undefined) - If the receiver accepts the offer, then
   * this is a Transfer object; otherwise it’s undefined.
   *
   * @param {Function} [options.on_progress] - Called immediately
   * after a chunk of a file is sent. Arguments are:
   *
   * - (File) - The File object that corresponds to the file.
   * - (Transfer) - The Transfer object for the current transfer.
   * - (Uint8Array) - The chunk of data that was just loaded from disk
   * and sent to the receiver.
   *
   * @param {Function} [options.on_file_complete] - Called immediately
   * after the last file packet is sent. Arguments are:
   *
   * - (File) - The File object that corresponds to the file.
   * - (Transfer) - The Transfer object for the now-completed transfer.
   *
   * @return {Promise} A Promise that fulfills when the batch is done.
   *      Note that skipped files are not considered an error condition.
   */
  send_files: function send_files(session: ZmodemSendSession, files: FileList, options?: SendFileOptions) {
    if (!options) options = {}

    //Populate the batch in reverse order to simplify sending
    //the remaining files/bytes components.
    const batch: FileObj[] = []
    let total_size = 0
    for (let f = files.length - 1; f >= 0; f--) {
      const fobj = files[f]
      total_size += fobj.size
      batch[f] = {
        obj: fobj,
        name: fobj.name,
        size: fobj.size,
        mtime: new Date(fobj.lastModified),
        files_remaining: files.length - f,
        bytes_remaining: total_size,
      }
    }

    let file_idx = 0

    function promise_callback() {
      const cur_b = batch[file_idx]

      if (!cur_b) {
        return Promise.resolve() //batch done!
      }

      file_idx++

      return session.send_offer(cur_b).then(function after_send_offer(xfer: Transfer) {
        if (options?.on_offer_response) {
          options.on_offer_response(cur_b.obj, xfer)
        }

        if (xfer === undefined) {
          return promise_callback() //skipped
        }

        return new Promise(function (res) {
          const reader = new FileReader()

          //This really shouldn’t happen … so let’s
          //blow up if it does.
          reader.onerror = function reader_onerror(e) {
            console.error('file read error', e)
            throw new Error('File read error: ' + e)
          }

          let piece: Uint8Array
          reader.onprogress = function reader_onprogress(e) {
            //Some browsers (e.g., Chrome) give partial returns,
            //while others (e.g., Firefox) don’t.
            if (e.target?.result) {
              piece = new Uint8Array(e.target.result, xfer.get_offset())

              _check_aborted(session)

              xfer.send(piece)

              if (options?.on_progress) {
                options.on_progress(cur_b.obj, xfer, piece)
              }
            }
          }

          reader.onload = function reader_onload(e) {
            piece = new Uint8Array(e.target.result, xfer, piece)

            _check_aborted(session)

            xfer.end(piece).then(function () {
              if (options?.on_progress && piece.length) {
                options.on_progress(cur_b.obj, xfer, piece)
              }

              if (options?.on_file_complete) {
                options.on_file_complete(cur_b.obj, xfer)
              }

              //Resolve the current file-send promise with
              //another promise. That promise resolves immediately
              //if we’re done, or with another file-send promise
              //if there’s more to send.
              res(promise_callback())
            })
          }

          reader.readAsArrayBuffer(cur_b.obj)
        })
      })
    }

    return promise_callback()
  },

  send_block_files: function send_block_files(session: ZmodemSendSession, files: FileList, options?: SendBlockFileOptions) {
    if (!options) options = {}

    //Populate the batch in reverse order to simplify sending
    //the remaining files/bytes components.
    var batch = []
    var total_size = 0
    for (var f = files.length - 1; f >= 0; f--) {
      var fobj = files[f]
      total_size += fobj.size
      batch[f] = {
        obj: fobj,
        name: fobj.name,
        size: fobj.size,
        mtime: new Date(fobj.lastModified),
        files_remaining: files.length - f,
        bytes_remaining: total_size,
      }
    }

    var file_idx = 0

    function promise_callback() {
      var cur_b = batch[file_idx]

      if (!cur_b) {
        return Promise.resolve() //batch done!
      }

      file_idx++

      return session.send_offer(cur_b).then(function after_send_offer(xfer) {
        if (options.on_offer_response) {
          options.on_offer_response(cur_b.obj, xfer)
        }

        if (xfer === undefined) {
          return promise_callback() //skipped
        }

        return new Promise(function (res) {
          var block = options.block ?? 1024 * 1024
          var fileSize = cur_b.size
          var fileLoaded = 0
          var reader = new FileReader()
          reader.onerror = function reader_onerror(e) {
            console.error('file read error', e)
            throw 'File read error: ' + e
          }

          function readBlob() {
            var blob
            if (cur_b.obj.slice) {
              blob = cur_b.obj.slice(fileLoaded, fileLoaded + block + 1)
            } else if (cur_b.obj.mozSlice) {
              blob = cur_b.obj.mozSlice(fileLoaded, fileLoaded + block + 1)
            } else if (cur_b.obj.webkitSlice) {
              blob = cur_b.obj.webkitSlice(fileLoaded, fileLoaded + block + 1)
            } else {
              blob = cur_b.obj
            }
            reader.readAsArrayBuffer(blob)
          }

          var piece
          reader.onload = function reader_onload(e) {
            try {
              fileLoaded += e.total
              if (fileLoaded < fileSize) {
                if (e.target.result) {
                  piece = new Uint8Array(e.target.result)
                  _check_aborted(session)
                  xfer.send(piece)
                  if (options.on_progress) {
                    options.on_progress(cur_b.obj, xfer, piece)
                  }
                }
                readBlob()
              } else {
                // 上传完成
                if (e.target.result) {
                  piece = new Uint8Array(e.target.result)
                  _check_aborted(session)
                  xfer.end(piece).then(function () {
                    // 放在内部, 即等待合成完再完成进度条
                    // if (options.on_progress && piece.length) {
                    //   options.on_progress(cur_b.obj, xfer, piece)
                    // }
                    if (options.on_file_complete) {
                      options.on_file_complete(cur_b.obj, xfer)
                    }

                    // 继续下个文件的上传
                    res(promise_callback())
                  })
                  // 先完成进度条, 再等待合成
                  if (options.on_progress) {
                    options.on_progress(cur_b.obj, xfer, piece)
                  }
                }
              }
            } catch (e) {
              console.log('错误中断上传: ', e)
              xfer.skip()
              // session.abort()
              // reader.abort()
            }
          }
          readBlob()
        })
      })
    }

    return promise_callback()
  },

  /**
   * Prompt a user to save the given packets as a file by injecting an
   * `<a>` element (with `display: none` styling) into the page and
   * calling the element’s `click()`
   * method. The element is removed immediately after.
   *
   * @param {Array} packets - Same as the first argument to [Blob’s constructor](https://developer.mozilla.org/en-US/docs/Web/API/Blob).
   * @param {string} name - The name to give the file.
   */
  save_to_disk: function save_to_disk(packets: Octets, name: string) {
    var blob = new Blob(packets)
    var url = URL.createObjectURL(blob)

    var el = document.createElement('a')
    el.style.display = 'none'
    el.href = url
    el.download = name
    document.body.appendChild(el)

    //It seems like a security problem that this actually works;
    //I’d think there would need to be some confirmation before
    //a browser could save arbitrarily many bytes onto the disk.
    //But, hey.
    el.click()

    document.body.removeChild(el)
  },
}
