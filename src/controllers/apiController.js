import {
  gitAdd,
  gitInit,
  gitMove,
  gitRemove,
  gitRestore,
  gitStatus,
  gitCommit,
  gitBranch,
} from "../modules/gitCommand.js";
//git 명령어를 실행하기 위한 helper library
import { simpleGit } from "simple-git";
import fs from "fs";
import os from "os";

const options = {
  baseDir: process.cwd(),
  binary: "git",
  maxConcurrentProcesses: 6,
  trimmed: true,
};
const gitHelper = simpleGit(options);

const checkRepo = (req, res, user) => {
  res.send(user.history.isRepo);
};

const checkUntracked = (req, res, user) => {
  res.send(user.history.directoryStatus);
};

const checkStatus = (req, res, user) => {
  res.json({ files: user.gitManager.gitFiles, isRepo: user.gitManager.isRepo });
};

const sendFiles = (req, res, user) => {
  res.send(user.gitManager.gitFiles);
};

const initGitRepository = (req, res, user) => {
  gitInit(user.path + `${req.body.dirName}/`)
    .then((result) => {
      res.status(200).send(result);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
};

const addFiles = async (req, res, user) => {
  const filePath = req.body.filePath;

  try {
    const result = await gitAdd(filePath, user.path);
    try {
      const logData = await gitStatus(user.path);
      user.gitManager.updateStatus(logData);
      res.status(200).send(result);
    } catch (error) {
      console.log(`Error[git status] :  ${error}`);
    }
  } catch (error) {
    console.log(`Error[git add] :  ${error}`);
    res.status(500).send(error);
  }
};

const commitFiles = async (req, res, user) => {
  const commitMessage = req.body.commitMessage;

  try {
    const result = await gitCommit(commitMessage, user.path);
    try {
      const logData = await gitStatus(user.path);
      user.gitManager.updateStatus(logData);
      res.status(200).send(result);
    } catch (error) {
      console.log(`Error[git status] :  ${error}`);
    }
  } catch (error) {
    console.log(`Error[git commit] :  ${error}`);
    res.status(500).send(error);
  }
};

const restoreFile = async (req, res, user) => {
  const fileName = req.body.fileName;
  const staged = req.params.staged === "1";

  try {
    const message = await gitRestore(fileName, staged, user.path);
    try {
      const logData = await gitStatus(user.path);
      user.gitManager.updateStatus(logData);
      res.status(200).send(message);
    } catch (error) {
      console.log(`Error[git status] :  ${error}`);
    }
  } catch (error) {
    console.log(`Error[git restore staged] :  ${error}`);
    res.status(500).send(error);
  }
};

const removeFile = async (req, res, user) => {
  const fileName = req.body.fileName;
  const staged2 = req.params.cached === "1";

  try {
    const message = await gitRemove(fileName, staged2, user.path);
    try {
      const logData = await gitStatus(user.path);
      user.gitManager.updateStatus(logData);
      res.status(200).send(message);
    } catch (error) {
      console.log(`Error[git status] :  ${error}`);
    }
  } catch (error) {
    console.log(`Error[git cached] :  ${error}`);
    res.status(500).send(error);
  }
};

const renameFile = async (req, res, user) => {
  const oldFileName = req.body.oldFileName;
  const newFileName = req.body.newFileName;

  try {
    const message = await gitMove(oldFileName, newFileName, user.path);
    try {
      const logData = await gitStatus(user.path);
      user.gitManager.updateStatus(logData);
      res.status(200).send(message);
    } catch (error) {
      console.log(`Error[git status] :  ${error}`);
    }
  } catch (error) {
    console.log(`Error[git move] :  ${error}`);
    res.status(500).send(error);
  }
};

const handleBranchRequest = async (req, res, user) => {
  const { mode, branchName, newName } = req.body;

  switch (mode) {
    case "get":
      res.send(user.gitManager.branch);
      break;

    case "create": {
      try {
        const message = await gitBranch(user.path, branchName);
        res.status(200).json({
          type: "success",
          msg: message,
        });
      } catch (error) {
        console.log("ERROR[create branch] : " + error);
        res.status(400).json({
          type: "error",
          msg: error,
        });
      }
      break;
    }
    case "delete": {
      try {
        await gitHelper.cwd(user.path);
        const commandResponse = await gitHelper.deleteLocalBranch(branchName);
        res.status(200).json({
          type: "success",
          msg: `Successfully deleted branch '${commandResponse}'!`,
        });
      } catch (error) {
        console.log("ERROR[delete branch] : " + error);
        res.status(400).json({
          type: "error",
          msg: "Failed to delete branch" + error,
        });
      }
      break;
    }
    case "rename": {
      try {
        await gitHelper.cwd(user.path);
        const branchResponse = await gitHelper.branchLocal();
        const renameResponse = await gitHelper.branch([
          "-m",
          branchName,
          newName,
        ]);
        if (branchResponse.current == branchName) {
          user.gitManager.branch = newName; //만약 현재 위치한 브랜치의 이름을 바꿨었다면
        }
        res.status(200).json({
          type: "success",
          msg: `Successfully renamed branch '${branchName}' to '${newName}'!`,
        });
      } catch (error) {
        res.status(400).json({
          type: "error",
          msg: "Failed to rename branch" + error,
        });
      }
      break;
    }
    case "checkout": {
      try {
        await gitHelper.cwd(user.path);
        const branchResponse = await gitHelper.branchLocal();
        await gitHelper.checkout(branchName);
        user.gitManager.branch = branchName;
        res.status(200).json({
          type: "success",
          msg: `Successfully checkout the branch from '${branchResponse.current}' to  '${branchName}'`,
        });
      } catch (error) {
        res.status(400).json({
          type: "error",
          msg: `failed to checkout given branch, ${error}`,
        });
      }
      break;
    }
  }
};

const showAllLocalBranches = async (req, res, user) => {
  try {
    gitHelper.cwd(user.path);
    const commandResponse = await gitHelper.branchLocal();
    res.status(200).json({
      type: "success",
      data: commandResponse,
    });
  } catch (error) {
    console.log("ERROR[show branches] : " + error);
    res.status(400).json({
      type: "error",
      msg: error,
    });
  }
};

const handleMergeRequest = async (req, res, user) => {
  try {
    gitHelper.cwd(user.path);
    const { targetBranch } = req.body;
    // const currentBranch = user.gitManager.branch;
    await gitHelper.merge([targetBranch]);
    res.status(200).json({
      type: "success",
      msg: `Successfully merged from '${targetBranch}' to  '${user.gitManager.branch}'`,
    });
  } catch (error) {
    //merge conflict 발생 시
    console.log(error);
    try {
      await gitHelper.reset(["--hard", "ORIG_HEAD"]);
      res.status(400).json({
        type: "error",
        msg: "Failed to Merge, but we aborted it.",
        errorData: error,
      });
    } catch (abortErr) {
      res.status(400).json({
        type: "error",
        msg: "Failed to Merge, and also something gone wrong while aborting merge.",
        errorData: abortErr,
      });
    }
  }
};

const handleCloneRequest = async (req, res, user) => {
  const remoteAddress = req.body.remoteAddress;
  const isPrivateRepo = req.body.isPrivateRepo;

  try {
    gitHelper.cwd(user.path);

    // 이미 git repo일 때 예외처리
    const isGitRepo = await gitHelper.checkIsRepo();

    if (isGitRepo) {
      res.status(400).json({
        type: "error",
        msg: "This directory is already a Git repository. You should clone i other directory.",
      });
      return;
    }

    if (isPrivateRepo === "private") {
      // config인지 확인?
      // 이름을 codernineteen
      
      let userIdInAddress;

      // remoteAddress에서 userId를 추출하기 위해 파싱함. 
      const remoteAddressRegex = /https?:\/\/github.com\/([^/]+)\//;
      const matches = remoteAddress.match(remoteAddressRegex);

      if (matches && matches.length >= 2) {
        userIdInAddress = matches[1];
      } else {
        // remoteAddress에서 사용자 ID를 추출할 수 없는 경우, 예외 처리
        res.status(400).json({
          type: "error",
          msg: "Invalid remote address. Unable to extract user ID."
        });
        return;
        }


      const configPath = `${os.homedir()}/.gitconfig`;

    } else if (isPrivateRepo === "public") {
      // else: public 레포일 때 처리
      // clone(repoPath: string, localPath: string, options?: TaskOptions | undefined, callback?: SimpleGitTaskCallback<string> | undefined): Response<string>
      gitHelper.clone(remoteAddress, user.path);
    } else {
      res.status(400).json({
        type: "error",
        msg: "Wrong repository type.",
      });
    }

    res.status(200).json({
      type: "success",
      msg: `Successfully clone from '${remoteAddress}'`,
    });
  } catch (error) {
    console.log(`Error[git clone] :  ${error}`);
    res.status(500).json({
      type: "error",
      msg: `Failed to clone from '${remoteAddress}'`,
      error: error,
    });
  }
};

const cloneWithCredentials = async (
  remoteAddress,
  localPath,
  userId,
  token
) => {
  const options = {
    // 사용자 ID와 토큰을 인증 정보로 사용
    auth: `${userId}:${token}`,
  };
  gitHelper.clone(remoteAddress, localPath, options);
};

export {
  checkRepo,
  checkStatus,
  checkUntracked,
  initGitRepository,
  sendFiles,
  addFiles,
  removeFile,
  restoreFile,
  commitFiles,
  renameFile,
  handleBranchRequest,
  showAllLocalBranches,
  handleMergeRequest,
  handleCloneRequest,
};
