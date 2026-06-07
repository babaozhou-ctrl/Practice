import { execSync } from "child_process";
import { writeFileSync, unlinkSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface WindowInfo {
  title: string;
  process: string;
  idleMs?: number;
}

let lastResult: WindowInfo = { title: "", process: "", idleMs: 0 };
let lastResultStr = "";

export function detectActiveWindow(): WindowInfo {
  let tempDir = "";
  let tempFile = "";
  try {
    tempDir = mkdtempSync(join(tmpdir(), "deep-pet-"));
    tempFile = join(tempDir, "getwin.ps1");

    const psLines = [
      'Add-Type -TypeDefinition @"',
      'using System;',
      'using System.Runtime.InteropServices;',
      'using System.Text;',
      'public class Win32 {',
      '  [DllImport("user32.dll")]',
      '  public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll")]',
      '  public static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);',
      '  [DllImport("user32.dll")]',
      '  public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
      '  [StructLayout(LayoutKind.Sequential)]',
      '  public struct LASTINPUTINFO {',
      '    public uint cbSize;',
      '    public uint dwTime;',
      '  }',
      '  [DllImport("user32.dll")]',
      '  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);',
      '  [DllImport("kernel32.dll")]',
      '  public static extern uint GetTickCount();',
      '}',
      '"@',
      '$hwnd = [Win32]::GetForegroundWindow()',
      '$sb = New-Object System.Text.StringBuilder 256',
      '[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null',
      '$title = $sb.ToString()',
      '$pid = 0',
      '[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null',
      '$proc = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName',
      '$lii = New-Object Win32+LASTINPUTINFO',
      '$lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][Win32+LASTINPUTINFO])',
      '$idleMs = 0',
      'if ([Win32]::GetLastInputInfo([ref]$lii)) {',
      '  $idleMs = [Math]::Max(0, [int64][Win32]::GetTickCount() - [int64]$lii.dwTime)',
      '}',
      'Write-Output "$title|||$proc|||$idleMs"',
    ];
    const psScript = psLines.join("\n");

    writeFileSync(tempFile, psScript, "utf-8");

    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
      { timeout: 5000, maxBuffer: 8192, encoding: "utf-8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
    ).toString().trim();

    const lines = result.split("\n").filter(l => l.includes("|||"));
    if (lines.length === 0) return lastResult;

    const parts = lines[0].split("|||");
    const info: WindowInfo = {
      title: (parts[0] || "").trim(),
      process: (parts[1] || "").trim(),
      idleMs: Math.max(0, Number((parts[2] || "0").trim()) || 0),
    };

    const str = info.title + "||" + info.process;
    if (str !== lastResultStr) {
      lastResultStr = str;
      lastResult = info;
    }
    return info;
  } catch (err: any) {
    return lastResult;
  } finally {
    if (tempFile) try { unlinkSync(tempFile) } catch {}
    if (tempDir) try { rmSync(tempDir, { recursive: true }) } catch {}
  }
}

