# 10. CLI 详细设计

> **所属文档：** [《软件详细设计说明》](../嵌入式UI工具_软件详细设计说明.md)  
> **章节：** §10  
> **版本：** 与主文档同步（见主文档 / §17 修订记录）

---
```text
forgeui <command> [options]

Commands:
  validate   <projectDir>
  generate   <projectDir> [--clean-generated] [--prune-orphans]
  preview    <projectDir> [--backend sdl]
  pack       <projectDir> [-o outDir]
  export-sdk <projectDir> [--force]
  bundle     <projectDir> -o file.forgeui [--no-codegen]
  unbundle   <file.forgeui> -o projectDir
  create     <projectDir> --platform qm10xd [--template hello-dual-screen]
```

| 命令 | Exit 0 | Exit ≠0 |
|------|--------|---------|
| validate | 无 error 级诊断 | 有 error |
| generate | CodeGen ok | 校验失败或写入失败 |
| preview | 进程启动成功（可选） | 编译/校验失败 |
| pack | V1 打包成功；MVP stub 可用 exit 2 + `E_PACK_NOT_IMPL` | 其它错误 |

---
